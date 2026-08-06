import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { config } from '../config.js';

const RATE_LIMIT_MAX = 200;
const RATE_LIMIT_WINDOW_MS = 60_000;

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();
let lastPrune = 0;

function pruneBuckets(now: number) {
  for (const [key, bucket] of rateBuckets.entries()) {
    if (bucket.resetAt <= now) {
      rateBuckets.delete(key);
    }
  }
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (now - lastPrune > RATE_LIMIT_WINDOW_MS) {
    pruneBuckets(now);
    lastPrune = now;
  }

  let bucket = rateBuckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateBuckets.set(ip, bucket);
    return false;
  }

  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

function isAuthOrRedeemPath(request: FastifyRequest): boolean {
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
    timeWindow: '1 minute',
  });

  fastify.addHook('preHandler', async (request, reply) => {
    if (isRateLimited(request.ip ?? 'unknown')) {
      reply.code(429).send({ error: 'Too Many Requests' });
      return;
    }

    const ua = request.headers['user-agent'];
    if (config.blockedIps.includes(request.ip)) {
      reply.code(403).send({ error: 'Forbidden' });
      return;
    }

    if (isAuthOrRedeemPath(request) && (!ua || ua.trim().length === 0)) {
      reply.code(400).send({ error: 'User-Agent required' });
      return;
    }

    const paramCount = Object.keys(request.params ?? {}).length + Object.keys(request.query ?? {}).length;
    if (paramCount > 25) {
      reply.code(400).send({ error: 'Too many parameters' });
      return;
    }
  });
}

export default fp(securityPlugin);
