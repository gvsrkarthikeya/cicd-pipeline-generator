import { describe, it, expect, beforeAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../lib/supabase.js', () => ({ default: { from: () => {} } }));
vi.mock('../../core/inferenceEngine.js', () => ({ runInferenceEngine: vi.fn() }));
vi.mock('../../core/recommender.js', () => ({ recommendOptimizations: vi.fn() }));
vi.mock('../../core/pipelineCustomizer.js', () => ({ customizePipeline: vi.fn() }));
vi.mock('../../core/pipelineService.js', () => ({ generateAndSavePipeline: vi.fn() }));
vi.mock('../../core/applyRecommendation.js', () => ({
  applyRecommendation: vi.fn(),
  APPLIABLE_RECOMMENDATION_TITLES: ['Add dependency caching'],
}));

const supabase = (await import('../../lib/supabase.js')).default;
const { runInferenceEngine } = await import('../../core/inferenceEngine.js');
const { recommendOptimizations } = await import('../../core/recommender.js');
const { customizePipeline } = await import('../../core/pipelineCustomizer.js');
const { generateAndSavePipeline } = await import('../../core/pipelineService.js');
const { applyRecommendation } = await import('../../core/applyRecommendation.js');
const { mockSupabaseFrom } = await import('./helpers/supabaseMock.js');
const pipelineRoutes = (await import('../pipeline.js')).default;
const { generateToken } = await import('../../lib/jwt.js');

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/pipeline', pipelineRoutes);
  return app;
}

const authHeader = () => ({ Authorization: `Bearer ${generateToken('u1')}` });

describe('POST /api/pipeline/generate', () => {
  const app = buildApp();

  it('400s when repoId is missing', async () => {
    const res = await request(app).post('/api/pipeline/generate').set(authHeader()).send({});
    expect(res.status).toBe(400);
  });

  it('404s when the repo is not found', async () => {
    mockSupabaseFrom(supabase, [{ data: null, error: null }]);
    const res = await request(app).post('/api/pipeline/generate').set(authHeader()).send({ repoId: 'r1' });
    expect(res.status).toBe(404);
  });

  it('generates and returns a pipeline for the repo\'s stored branch', async () => {
    mockSupabaseFrom(supabase, [{ data: { id: 'r1', repo_url: 'https://github.com/a/b', branch: 'main', is_private: false }, error: null }]);
    generateAndSavePipeline.mockResolvedValueOnce({
      success: true,
      pipeline: { id: 'p1' },
      analysis: { analysis: { language: 'nodejs' } },
      decisions: { steps: ['checkout'] },
      explanationSummary: { totalDecisions: 1 },
      recommendations: [],
    });

    const res = await request(app).post('/api/pipeline/generate').set(authHeader()).send({ repoId: 'r1' });

    expect(res.status).toBe(201);
    expect(res.body.pipeline.id).toBe('p1');
    expect(generateAndSavePipeline).toHaveBeenCalledWith(
      expect.objectContaining({ repoId: 'r1', branch: 'main' })
    );
  });

  it('updates the stored branch first when a branch override is provided', async () => {
    mockSupabaseFrom(supabase, [
      { data: { id: 'r1', repo_url: 'https://github.com/a/b', branch: 'main', is_private: false }, error: null },
      { data: null, error: null }, // branch update
    ]);
    generateAndSavePipeline.mockResolvedValueOnce({
      success: true,
      pipeline: { id: 'p2' },
      analysis: { analysis: {} },
      decisions: {},
      explanationSummary: {},
      recommendations: [],
    });

    const res = await request(app)
      .post('/api/pipeline/generate')
      .set(authHeader())
      .send({ repoId: 'r1', branch: 'feature/x' });

    expect(res.status).toBe(201);
    expect(generateAndSavePipeline).toHaveBeenCalledWith(
      expect.objectContaining({ branch: 'feature/x' })
    );
  });

  it('400s when pipeline generation fails', async () => {
    mockSupabaseFrom(supabase, [{ data: { id: 'r1', repo_url: 'x', branch: 'main', is_private: false }, error: null }]);
    generateAndSavePipeline.mockResolvedValueOnce({ success: false, error: 'Analysis failed' });

    const res = await request(app).post('/api/pipeline/generate').set(authHeader()).send({ repoId: 'r1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Analysis failed');
  });
});

describe('PUT /api/pipeline/:repoId', () => {
  const app = buildApp();

  it('400s for an invalid operation', async () => {
    const res = await request(app)
      .put('/api/pipeline/r1')
      .set(authHeader())
      .send({ operation: 'nope', stepName: 'Run tests' });
    expect(res.status).toBe(400);
  });

  it('400s when stepName is missing', async () => {
    const res = await request(app).put('/api/pipeline/r1').set(authHeader()).send({ operation: 'add' });
    expect(res.status).toBe(400);
  });

  it('404s when the repo is not found', async () => {
    mockSupabaseFrom(supabase, [{ data: null, error: null }]);
    const res = await request(app)
      .put('/api/pipeline/r1')
      .set(authHeader())
      .send({ operation: 'add', stepName: 'New step', step: { run: 'echo hi' } });
    expect(res.status).toBe(404);
  });

  it('404s when no pipeline exists yet for the repo', async () => {
    mockSupabaseFrom(supabase, [
      { data: { id: 'r1' }, error: null },
      { data: null, error: { message: 'none' } },
    ]);
    const res = await request(app)
      .put('/api/pipeline/r1')
      .set(authHeader())
      .send({ operation: 'add', stepName: 'New step', step: { run: 'echo hi' } });
    expect(res.status).toBe(404);
  });

  it('400s when customizePipeline throws', async () => {
    mockSupabaseFrom(supabase, [
      { data: { id: 'r1' }, error: null },
      { data: { id: 'p1', yaml_content: 'name: x', reasoning: [] }, error: null },
    ]);
    customizePipeline.mockImplementationOnce(() => {
      throw new Error('Step not found');
    });
    const res = await request(app)
      .put('/api/pipeline/r1')
      .set(authHeader())
      .send({ operation: 'edit', stepName: 'Missing step', step: { run: 'echo hi' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Step not found');
  });

  it('saves the customized pipeline and logs history on success', async () => {
    mockSupabaseFrom(supabase, [
      { data: { id: 'r1' }, error: null },
      { data: { id: 'p1', yaml_content: 'name: x', reasoning: [] }, error: null },
      { data: { id: 'p2' }, error: null }, // insert new pipeline
      { data: { id: 'h1', action: 'ADD' }, error: null }, // insert history
    ]);
    customizePipeline.mockReturnValueOnce({
      yaml: 'name: x (updated)',
      beforeStep: null,
      afterStep: { run: 'echo hi' },
    });

    const res = await request(app)
      .put('/api/pipeline/r1')
      .set(authHeader())
      .send({ operation: 'add', stepName: 'New step', step: { run: 'echo hi' } });

    expect(res.status).toBe(200);
    expect(res.body.pipeline.id).toBe('p2');
    expect(res.body.history.id).toBe('h1');
  });
});

describe('GET /api/pipeline/:repoId/recommendations', () => {
  const app = buildApp();

  it('404s when the repo is not found', async () => {
    mockSupabaseFrom(supabase, [{ data: null, error: null }]);
    const res = await request(app).get('/api/pipeline/r1/recommendations').set(authHeader());
    expect(res.status).toBe(404);
  });

  it('404s when the repo has not been analyzed yet', async () => {
    mockSupabaseFrom(supabase, [{ data: { id: 'r1', detected_stack: null }, error: null }]);
    const res = await request(app).get('/api/pipeline/r1/recommendations').set(authHeader());
    expect(res.status).toBe(404);
  });

  it('returns recommendations on success', async () => {
    mockSupabaseFrom(supabase, [
      { data: { id: 'r1', branch: 'main', detected_stack: { success: true, analysis: {} } }, error: null },
    ]);
    runInferenceEngine.mockReturnValueOnce({ success: true, decisions: {} });
    recommendOptimizations.mockReturnValueOnce({
      success: true,
      recommendations: [{ title: 'Add dependency caching' }],
      summary: { total: 1 },
    });

    const res = await request(app).get('/api/pipeline/r1/recommendations').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.recommendations).toHaveLength(1);
    expect(res.body.appliableTitles).toContain('Add dependency caching');
  });
});

describe('POST /api/pipeline/:repoId/apply-recommendation', () => {
  const app = buildApp();

  it('400s when title is missing', async () => {
    const res = await request(app).post('/api/pipeline/r1/apply-recommendation').set(authHeader()).send({});
    expect(res.status).toBe(400);
  });

  it('400s when applyRecommendation throws (e.g. already applied)', async () => {
    mockSupabaseFrom(supabase, [
      { data: { id: 'r1' }, error: null },
      { data: { id: 'p1', yaml_content: 'name: x', reasoning: [] }, error: null },
    ]);
    applyRecommendation.mockImplementationOnce(() => {
      throw new Error('Dependency caching is already enabled');
    });

    const res = await request(app)
      .post('/api/pipeline/r1/apply-recommendation')
      .set(authHeader())
      .send({ title: 'Add dependency caching' });
    expect(res.status).toBe(400);
  });

  it('applies the recommendation and logs history on success', async () => {
    mockSupabaseFrom(supabase, [
      { data: { id: 'r1' }, error: null },
      { data: { id: 'p1', yaml_content: 'name: x', reasoning: [] }, error: null },
      { data: { id: 'p2' }, error: null },
      { data: { id: 'h1' }, error: null },
    ]);
    applyRecommendation.mockReturnValueOnce({ yaml: 'name: x (cached)', description: 'Enabled caching' });

    const res = await request(app)
      .post('/api/pipeline/r1/apply-recommendation')
      .set(authHeader())
      .send({ title: 'Add dependency caching' });

    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Enabled caching');
  });
});

describe('GET /api/pipeline/:repoId', () => {
  const app = buildApp();

  it('404s when the repo is not found', async () => {
    mockSupabaseFrom(supabase, [{ data: null, error: null }]);
    const res = await request(app).get('/api/pipeline/r1').set(authHeader());
    expect(res.status).toBe(404);
  });

  it('404s when no pipeline exists yet', async () => {
    mockSupabaseFrom(supabase, [
      { data: { id: 'r1' }, error: null },
      { data: null, error: { message: 'none' } },
    ]);
    const res = await request(app).get('/api/pipeline/r1').set(authHeader());
    expect(res.status).toBe(404);
  });

  it('returns the most recent pipeline on success', async () => {
    mockSupabaseFrom(supabase, [
      { data: { id: 'r1' }, error: null },
      { data: { id: 'p1', yaml_content: 'name: x' }, error: null },
    ]);
    const res = await request(app).get('/api/pipeline/r1').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.pipeline.id).toBe('p1');
  });
});
