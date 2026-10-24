import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { protect } from '../auth.js';
import { generateToken } from '../../lib/jwt.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
});

function buildApp() {
  const app = express();
  app.get('/protected', protect, (req, res) => res.json({ userId: req.userId }));
  return app;
}

describe('protect middleware', () => {
  const app = buildApp();

  it('401s when no Authorization header is present', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/No token provided/);
  });

  it('401s when the header does not start with "Bearer "', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Basic abc');
    expect(res.status).toBe(401);
  });

  it('401s for an invalid token', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid token/);
  });

  it('attaches req.userId and calls next() for a valid token', async () => {
    const token = generateToken('user-42');
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('user-42');
  });
});
