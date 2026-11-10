import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../lib/supabase.js', () => ({ default: { from: () => {} } }));
vi.mock('../../lib/github.js', () => ({ verifyRepoAccess: vi.fn(), getDefaultBranch: vi.fn() }));
vi.mock('../../core/analyzer.js', () => ({ analyzeRepo: vi.fn() }));
vi.mock('../../core/pipelineService.js', () => ({ generateAndSavePipeline: vi.fn() }));

const supabase = (await import('../../lib/supabase.js')).default;
const { verifyRepoAccess, getDefaultBranch } = await import('../../lib/github.js');
const { analyzeRepo } = await import('../../core/analyzer.js');
const { generateAndSavePipeline } = await import('../../core/pipelineService.js');
const { mockSupabaseFrom } = await import('./helpers/supabaseMock.js');
const reposRoutes = (await import('../repos.js')).default;
const { generateToken } = await import('../../lib/jwt.js');

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
});

beforeEach(() => {
  getDefaultBranch.mockClear();
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/repos', reposRoutes);
  return app;
}

const authHeader = () => ({ Authorization: `Bearer ${generateToken('u1')}` });

describe('POST /api/repos/verify-token', () => {
  const app = buildApp();

  it('400s when repoUrl or githubToken is missing', async () => {
    const res = await request(app).post('/api/repos/verify-token').set(authHeader()).send({});
    expect(res.status).toBe(400);
  });

  it('returns the verification result on success', async () => {
    verifyRepoAccess.mockResolvedValueOnce({ valid: true, isPrivate: true });
    const res = await request(app)
      .post('/api/repos/verify-token')
      .set(authHeader())
      .send({ repoUrl: 'https://github.com/a/b', githubToken: 'tok' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valid: true, isPrivate: true });
  });

  it('400s when verifyRepoAccess throws', async () => {
    verifyRepoAccess.mockRejectedValueOnce(new Error('Invalid GitHub token'));
    const res = await request(app)
      .post('/api/repos/verify-token')
      .set(authHeader())
      .send({ repoUrl: 'https://github.com/a/b', githubToken: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid GitHub token');
  });
});

describe('GET /api/repos', () => {
  const app = buildApp();

  it('401s without auth', async () => {
    const res = await request(app).get('/api/repos');
    expect(res.status).toBe(401);
  });

  it('lists the current user\'s repos', async () => {
    mockSupabaseFrom(supabase, [{ data: [{ id: 'r1' }, { id: 'r2' }], error: null }]);
    const res = await request(app).get('/api/repos').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.repos).toHaveLength(2);
  });
});

describe('GET /api/repos/:id', () => {
  const app = buildApp();

  it('404s when the repo is not found', async () => {
    mockSupabaseFrom(supabase, [{ data: null, error: { message: 'not found' } }]);
    const res = await request(app).get('/api/repos/r1').set(authHeader());
    expect(res.status).toBe(404);
  });

  it('returns the repo on success', async () => {
    mockSupabaseFrom(supabase, [{ data: { id: 'r1', repo_url: 'https://github.com/a/b' }, error: null }]);
    const res = await request(app).get('/api/repos/r1').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.repo.id).toBe('r1');
  });
});

describe('DELETE /api/repos/:id', () => {
  const app = buildApp();

  it('404s when the repo does not belong to the user', async () => {
    mockSupabaseFrom(supabase, [{ data: null, error: null }]);
    const res = await request(app).delete('/api/repos/r1').set(authHeader());
    expect(res.status).toBe(404);
  });

  it('204s on successful delete', async () => {
    mockSupabaseFrom(supabase, [{ data: { id: 'r1' }, error: null }]);
    const res = await request(app).delete('/api/repos/r1').set(authHeader());
    expect(res.status).toBe(204);
  });
});

describe('POST /api/repos', () => {
  const app = buildApp();

  it('400s when repoUrl is missing', async () => {
    const res = await request(app).post('/api/repos').set(authHeader()).send({});
    expect(res.status).toBe(400);
  });

  it('400s when isPrivate is true but no githubToken is provided', async () => {
    const res = await request(app)
      .post('/api/repos')
      .set(authHeader())
      .send({ repoUrl: 'https://github.com/a/b', isPrivate: true });
    expect(res.status).toBe(400);
  });

  it('400s when analysis fails', async () => {
    getDefaultBranch.mockResolvedValueOnce('main');
    analyzeRepo.mockResolvedValueOnce({ success: false, error: 'Repository not found' });
    const res = await request(app)
      .post('/api/repos')
      .set(authHeader())
      .send({ repoUrl: 'https://github.com/a/b' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Repository not found');
  });

  it('resolves the default branch via GitHub when none is provided', async () => {
    getDefaultBranch.mockResolvedValueOnce('master');
    analyzeRepo.mockResolvedValueOnce({ success: true, analysis: { language: 'nodejs' } });
    mockSupabaseFrom(supabase, [{ data: { id: 'r1', repo_url: 'https://github.com/a/b', branch: 'master' }, error: null }]);
    generateAndSavePipeline.mockResolvedValueOnce({ success: true });

    const res = await request(app)
      .post('/api/repos')
      .set(authHeader())
      .send({ repoUrl: 'https://github.com/a/b' });

    expect(res.status).toBe(201);
    expect(getDefaultBranch).toHaveBeenCalledWith('https://github.com/a/b', null);
    expect(analyzeRepo).toHaveBeenCalledWith('https://github.com/a/b', 'master', null);
  });

  it('skips default-branch resolution when a branch is explicitly provided', async () => {
    analyzeRepo.mockResolvedValueOnce({ success: true, analysis: { language: 'nodejs' } });
    mockSupabaseFrom(supabase, [{ data: { id: 'r1', repo_url: 'https://github.com/a/b', branch: 'develop' }, error: null }]);
    generateAndSavePipeline.mockResolvedValueOnce({ success: true });

    const res = await request(app)
      .post('/api/repos')
      .set(authHeader())
      .send({ repoUrl: 'https://github.com/a/b', branch: 'develop' });

    expect(res.status).toBe(201);
    expect(getDefaultBranch).not.toHaveBeenCalled();
    expect(analyzeRepo).toHaveBeenCalledWith('https://github.com/a/b', 'develop', null);
  });

  it('creates the repo, auto-generates a pipeline, and returns 201 on success', async () => {
    getDefaultBranch.mockResolvedValueOnce('main');
    analyzeRepo.mockResolvedValueOnce({ success: true, analysis: { language: 'nodejs' } });
    mockSupabaseFrom(supabase, [{ data: { id: 'r1', repo_url: 'https://github.com/a/b' }, error: null }]);
    generateAndSavePipeline.mockResolvedValueOnce({ success: true });

    const res = await request(app)
      .post('/api/repos')
      .set(authHeader())
      .send({ repoUrl: 'https://github.com/a/b' });

    expect(res.status).toBe(201);
    expect(res.body.repo.id).toBe('r1');
    expect(res.body.pipelineGenerated).toBe(true);
  });
});
