import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { config } from '../config.js';

const RATE_LIMIT_MAX = 200;
const RATE_LIMIT_WINDOW_MS = 60_000;

function isPublicPath(request: FastifyRequest): boolean {
  return request.url.startsWith('/api/auth') || request.url.startsWith('/api/redeem');
}

async function securityPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(helmet);
  await fastify.register(cors, {
    origin: config.allowedOrigins.length > 0 ? config.allowedOrigins : true,
    credentials: true,
  });

  await fastify.register(rateLimit, {
    global: true,
    max: RATE_LIMIT_MAX,
    timeWindow: RATE_LIMIT_WINDOW_MS,
    hook: 'preHandler',
  });

  // Run cheap security checks in preValidation (before the preHandler rate limit)
  // so blocked traffic is rejected without counting against the rate limit budget.
  fastify.addHook('preValidation', async (request, reply) => {
    if (config.blockedIps.includes(request.ip)) {
      reply.code(403).send({ error: 'Forbidden' });
      return;
    }

    const ua = request.headers['user-agent'];
    if (isPublicPath(request) && (!ua || ua.trim().length === 0)) {
      reply.code(400).send({ error: 'User-Agent required' });
      return;
    }

    const paramCount =
      Object.keys(request.params ?? {}).length + Object.keys(request.query ?? {}).length;
    if (paramCount > 25) {
      reply.code(400).send({ error: 'Too many parameters' });
      return;
    }
  });
}

export default fp(securityPlugin);
