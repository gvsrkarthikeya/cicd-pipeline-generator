import { describe, it, expect, beforeAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../lib/supabase.js', () => ({ default: { from: () => {} } }));
vi.mock('../../core/pipelineCustomizer.js', () => ({ customizePipeline: vi.fn() }));

const supabase = (await import('../../lib/supabase.js')).default;
const { customizePipeline } = await import('../../core/pipelineCustomizer.js');
const { mockSupabaseFrom } = await import('./helpers/supabaseMock.js');
const historyRoutes = (await import('../history.js')).default;
const { generateToken } = await import('../../lib/jwt.js');

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/history', historyRoutes);
  return app;
}

const authHeader = () => ({ Authorization: `Bearer ${generateToken('u1')}` });

describe('GET /api/history/:repoId', () => {
  const app = buildApp();

  it('returns the history list for a repo', async () => {
    mockSupabaseFrom(supabase, [{ data: [{ id: 'h1' }, { id: 'h2' }], error: null }]);
    const res = await request(app).get('/api/history/r1').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.history).toHaveLength(2);
  });
});

describe('POST /api/history/:repoId', () => {
  const app = buildApp();

  it('400s for an invalid action', async () => {
    const res = await request(app)
      .post('/api/history/r1')
      .set(authHeader())
      .send({ action: 'NOPE', stepName: 'x' });
    expect(res.status).toBe(400);
  });

  it('201s and inserts a history row on success', async () => {
    mockSupabaseFrom(supabase, [{ data: { id: 'h1', action: 'ADD' }, error: null }]);
    const res = await request(app)
      .post('/api/history/r1')
      .set(authHeader())
      .send({ action: 'ADD', stepName: 'Run tests', afterState: { run: 'npm test' } });
    expect(res.status).toBe(201);
    expect(res.body.history.id).toBe('h1');
  });
});

describe('POST /api/history/:historyId/share', () => {
  const app = buildApp();

  it('404s when the history entry is not found', async () => {
    mockSupabaseFrom(supabase, [{ data: null, error: null }]);
    const res = await request(app).post('/api/history/h1/share').set(authHeader());
    expect(res.status).toBe(404);
  });

  it('returns the existing share_id if already shared', async () => {
    mockSupabaseFrom(supabase, [{ data: { id: 'h1', share_id: 'existing-id' }, error: null }]);
    const res = await request(app).post('/api/history/h1/share').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.shareId).toBe('existing-id');
  });

  it('generates and persists a new share_id when none exists', async () => {
    mockSupabaseFrom(supabase, [
      { data: { id: 'h1', share_id: null }, error: null },
      { data: null, error: null }, // update
    ]);
    const res = await request(app).post('/api/history/h1/share').set(authHeader());
    expect(res.status).toBe(201);
    expect(res.body.shareId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('POST /api/history/:historyId/revert', () => {
  const app = buildApp();

  it('404s when the history entry is not found', async () => {
    mockSupabaseFrom(supabase, [{ data: null, error: null }]);
    const res = await request(app).post('/api/history/h1/revert').set(authHeader());
    expect(res.status).toBe(404);
  });

  it('404s when no pipeline exists for the repo', async () => {
    mockSupabaseFrom(supabase, [
      { data: { id: 'h1', repo_id: 'r1', action: 'ADD', step_name: 'Run tests' }, error: null },
      { data: null, error: { message: 'none' } },
    ]);
    const res = await request(app).post('/api/history/h1/revert').set(authHeader());
    expect(res.status).toBe(404);
  });

  it('400s when trying to revert an unsupported action', async () => {
    mockSupabaseFrom(supabase, [
      { data: { id: 'h1', repo_id: 'r1', action: 'WEIRD', step_name: 'x' }, error: null },
      { data: { id: 'p1', yaml_content: 'name: x', reasoning: [] }, error: null },
    ]);
    const res = await request(app).post('/api/history/h1/revert').set(authHeader());
    expect(res.status).toBe(400);
  });

  it('reverts an ADD by deleting the step', async () => {
    mockSupabaseFrom(supabase, [
      { data: { id: 'h1', repo_id: 'r1', action: 'ADD', step_name: 'Run tests' }, error: null },
      { data: { id: 'p1', yaml_content: 'name: x', reasoning: [] }, error: null },
      { data: { id: 'p2' }, error: null },
      { data: { id: 'h2', action: 'DELETE' }, error: null },
    ]);
    customizePipeline.mockReturnValueOnce({ yaml: 'name: x (reverted)' });

    const res = await request(app).post('/api/history/h1/revert').set(authHeader());
    expect(res.status).toBe(200);
    expect(customizePipeline).toHaveBeenCalledWith('name: x', 'delete', 'Run tests', undefined);
  });
});
