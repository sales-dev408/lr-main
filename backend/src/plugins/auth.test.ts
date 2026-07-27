import Fastify from 'fastify';
import { beforeAll, describe, expect, it } from 'vitest';
import authPlugin from './auth.js';
import { signJwt } from '../services/jwt.js';
import type { FastifyInstance } from 'fastify';

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(authPlugin);
  app.get('/admin/content', { preHandler: app.requireRole(['admin']) }, async () => ({ ok: true }));
  await app.ready();
  return app;
}

describe('requireRole', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  it('rejects anonymous requests to admin-only routes', async () => {
    const response = await app.inject({ method: 'GET', url: '/admin/content' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects an authenticated customer', async () => {
    const token = signJwt({ sub: 'user-1', role: 'customer', email: 'member@example.com' });
    const response = await app.inject({
      method: 'GET',
      url: '/admin/content',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it('allows an admin', async () => {
    const token = signJwt({ sub: 'admin-1', role: 'admin', email: 'admin@example.com' });
    const response = await app.inject({
      method: 'GET',
      url: '/admin/content',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });
});
