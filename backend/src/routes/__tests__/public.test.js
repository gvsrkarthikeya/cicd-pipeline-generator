import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../lib/supabase.js', () => ({ default: { from: () => {} } }));

const supabase = (await import('../../lib/supabase.js')).default;
const { mockSupabaseFrom } = await import('./helpers/supabaseMock.js');
const publicRoutes = (await import('../public.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public', publicRoutes);
  return app;
}

describe('GET /api/public/pipeline/:shareId', () => {
  const app = buildApp();

  it('requires no authentication', async () => {
    mockSupabaseFrom(supabase, [
      { data: { action: 'ADD', step_name: 'Run tests', repos: { repo_url: 'https://github.com/a/b' } }, error: null },
    ]);
    const res = await request(app).get('/api/public/pipeline/share-123');
    expect(res.status).toBe(200);
  });

  it('404s when the share_id does not match any entry', async () => {
    mockSupabaseFrom(supabase, [{ data: null, error: { message: 'not found' } }]);
    const res = await request(app).get('/api/public/pipeline/unknown');
    expect(res.status).toBe(404);
  });

  it('returns the snapshot payload on success', async () => {
    mockSupabaseFrom(supabase, [
      {
        data: {
          action: 'EDIT',
          step_name: 'Run lint',
          before_state: null,
          after_state: { run: 'npm run lint' },
          created_at: '2026-01-01',
          repos: { repo_url: 'https://github.com/a/b' },
        },
        error: null,
      },
    ]);
    const res = await request(app).get('/api/public/pipeline/share-123');
    expect(res.status).toBe(200);
    expect(res.body.snapshot.step_name).toBe('Run lint');
    expect(res.body.snapshot.repos.repo_url).toBe('https://github.com/a/b');
  });
});
