import { describe, it, expect, beforeAll } from 'vitest';
import { generateToken, verifyToken } from '../jwt.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
});

describe('jwt', () => {
  it('generateToken produces a token that verifyToken can decode back to the same userId', () => {
    const token = generateToken('user-123');
    expect(typeof token).toBe('string');

    const decoded = verifyToken(token);
    expect(decoded.userId).toBe('user-123');
  });

  it('verifyToken throws for a tampered/invalid token', () => {
    expect(() => verifyToken('not-a-real-token')).toThrow();
  });

  it('verifyToken throws for a token signed with a different secret', () => {
    const token = generateToken('user-456');
    const realSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'a-different-secret';

    expect(() => verifyToken(token)).toThrow();

    process.env.JWT_SECRET = realSecret;
  });
});
