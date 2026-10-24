import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

vi.mock('../../lib/supabase.js', () => ({ default: { from: () => {} } }));

const supabase = (await import('../../lib/supabase.js')).default;
const { mockSupabaseFrom } = await import('./helpers/supabaseMock.js');
const authRoutes = (await import('../auth.js')).default;
const { generateToken } = await import('../../lib/jwt.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return app;
}

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
});

function fingerprint(hash) {
  return crypto.createHash('sha256').update(hash).digest('hex').slice(0, 16);
}

describe('POST /api/auth/signup', () => {
  const app = buildApp();

  it('400s when a required field is missing', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'a@b.com', password: 'pw' });
    expect(res.status).toBe(400);
  });

  it('400s when the email is already registered', async () => {
    mockSupabaseFrom(supabase, [{ data: { id: 'u1' }, error: null }]);
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'A', email: 'a@b.com', password: 'password1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already registered/);
  });

  it('creates a user and returns a token on success', async () => {
    mockSupabaseFrom(supabase, [
      { data: null, error: null }, // existence check — no existing user
      { data: { id: 'u2', name: 'A', email: 'a@b.com' }, error: null }, // insert
    ]);

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'A', email: 'a@b.com', password: 'password1' });

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({ id: 'u2', name: 'A', email: 'a@b.com' });
    expect(typeof res.body.token).toBe('string');
  });
});

describe('POST /api/auth/login', () => {
  const app = buildApp();

  it('400s when email or password is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('401s for an unknown email', async () => {
    mockSupabaseFrom(supabase, [{ data: null, error: { message: 'not found' } }]);
    const res = await request(app).post('/api/auth/login').send({ email: 'x@y.com', password: 'pw' });
    expect(res.status).toBe(401);
  });

  it('401s for a wrong password', async () => {
    const password_hash = await bcrypt.hash('correct-password', 10);
    mockSupabaseFrom(supabase, [
      { data: { id: 'u1', name: 'A', email: 'a@b.com', password_hash }, error: null },
    ]);
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('200s and returns a token for valid credentials', async () => {
    const password_hash = await bcrypt.hash('correct-password', 10);
    mockSupabaseFrom(supabase, [
      { data: { id: 'u1', name: 'A', email: 'a@b.com', password_hash }, error: null },
    ]);
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'correct-password' });
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 'u1', name: 'A', email: 'a@b.com' });
    expect(typeof res.body.token).toBe('string');
  });
});

describe('GET /api/auth/me', () => {
  const app = buildApp();

  it('401s without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the profile for a valid token', async () => {
    const token = generateToken('u1');
    mockSupabaseFrom(supabase, [
      { data: { id: 'u1', name: 'A', email: 'a@b.com', created_at: '2026-01-01' }, error: null },
    ]);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('a@b.com');
  });
});

describe('PUT /api/auth/profile', () => {
  const app = buildApp();

  it('400s when name is empty', async () => {
    const token = generateToken('u1');
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '  ' });
    expect(res.status).toBe(400);
  });

  it('updates the name on success', async () => {
    const token = generateToken('u1');
    mockSupabaseFrom(supabase, [{ data: { id: 'u1', name: 'New Name', email: 'a@b.com' }, error: null }]);
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('New Name');
  });
});

describe('PUT /api/auth/password', () => {
  const app = buildApp();

  it('400s when passwords are missing', async () => {
    const token = generateToken('u1');
    const res = await request(app).put('/api/auth/password').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });

  it('400s when the new password is too short', async () => {
    const token = generateToken('u1');
    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'old-password', newPassword: 'short' });
    expect(res.status).toBe(400);
  });

  it('401s when the current password is incorrect', async () => {
    const token = generateToken('u1');
    const password_hash = await bcrypt.hash('correct-password', 10);
    mockSupabaseFrom(supabase, [{ data: { id: 'u1', password_hash }, error: null }]);
    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrong', newPassword: 'new-password1' });
    expect(res.status).toBe(401);
  });

  it('200s and updates the password hash on success', async () => {
    const token = generateToken('u1');
    const password_hash = await bcrypt.hash('correct-password', 10);
    mockSupabaseFrom(supabase, [
      { data: { id: 'u1', password_hash }, error: null },
      { data: null, error: null },
    ]);
    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'correct-password', newPassword: 'new-password1' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/auth/forgot-password', () => {
  const app = buildApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('400s when email is missing', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });

  it('returns success without a resetToken for an unknown email (no enumeration leak)', async () => {
    mockSupabaseFrom(supabase, [{ data: null, error: null }]);
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@x.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.resetToken).toBeUndefined();
  });

  it('returns a resetToken for a known email', async () => {
    mockSupabaseFrom(supabase, [{ data: { id: 'u1', password_hash: 'hash123' }, error: null }]);
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'a@b.com' });
    expect(res.status).toBe(200);
    expect(typeof res.body.resetToken).toBe('string');

    const payload = jwt.verify(res.body.resetToken, process.env.JWT_SECRET);
    expect(payload.userId).toBe('u1');
    expect(payload.purpose).toBe('reset');
    expect(payload.pwv).toBe(fingerprint('hash123'));
  });
});

describe('POST /api/auth/reset-password', () => {
  const app = buildApp();

  it('400s when token or password is missing', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'abc' });
    expect(res.status).toBe(400);
  });

  it('400s for an invalid/garbage token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'garbage', password: 'new-password1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or has expired/);
  });

  it('400s when the token has already been used (password fingerprint mismatch)', async () => {
    const resetToken = jwt.sign(
      { userId: 'u1', purpose: 'reset', pwv: 'stale-fingerprint' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    mockSupabaseFrom(supabase, [{ data: { id: 'u1', password_hash: 'current-hash' }, error: null }]);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, password: 'new-password1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already been used/);
  });

  it('200s and resets the password for a valid, unused token', async () => {
    const currentHash = 'current-hash';
    const resetToken = jwt.sign(
      { userId: 'u1', purpose: 'reset', pwv: fingerprint(currentHash) },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    mockSupabaseFrom(supabase, [
      { data: { id: 'u1', password_hash: currentHash }, error: null },
      { data: null, error: null },
    ]);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, password: 'new-password1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
