import type { FastifyInstance } from 'fastify';
import { getPool } from '../db/pool.js';

export async function registerHealthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/health', { config: { rateLimit: { max: 100, timeWindow: '1 minute' } } }, async () => {
    const pool = getPool();
    let db = false;

    if (pool) {
      try {
        await pool.query('SELECT 1');
        db = true;
      } catch {
        db = false;
      }
    }

    return { status: 'ok', db };
  });

  fastify.get('/', { config: { rateLimit: { max: 100, timeWindow: '1 minute' } } }, async () => ({
    name: 'Master Gift/Discount Card System Backend',
    version: '0.1.0',
  }));

  // NCAA API proxy endpoint to bypass CORS/DNS issues
  fastify.get('/api/proxy/ncaa/scoreboard/:sport/:path', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { sport, path } = request.params as { sport: string; path: string };
    const ncaaUrl = `https://api.ncaa.com/scoreboard/${sport}/${path}`;
    
    try {
      const response = await fetch(ncaaUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        return reply.code(response.status).send({ error: `NCAA API error: ${response.status}` });
      }
      
      const data = await response.json();
      return reply.send(data);
    } catch (error) {
      console.error('NCAA API proxy error:', error);
      return reply.code(502).send({ error: 'Failed to fetch from NCAA API' });
    }
  });

  // NCAA API proxy endpoint for standings
  fastify.get('/api/proxy/ncaa/standings/:sport/:division/:conference?', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { sport, division } = request.params as { sport: string; division: string };
    const { conference } = request.query as { conference?: string };
    const conferencePath = conference ? `/${conference}` : '';
    const ncaaUrl = `https://api.ncaa.com/standings/${sport}/${division}${conferencePath}`;
    
    try {
      const response = await fetch(ncaaUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        return reply.code(response.status).send({ error: `NCAA API error: ${response.status}` });
      }
      
      const data = await response.json();
      return reply.send(data);
    } catch (error) {
      console.error('NCAA API proxy error:', error);
      return reply.code(502).send({ error: 'Failed to fetch from NCAA API' });
    }
  });
}
