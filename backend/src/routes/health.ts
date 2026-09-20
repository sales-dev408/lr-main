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
    
    // Validate and sanitize parameters to prevent SSRF
    const allowedSports = /^(football|basketball-men|basketball-women|soccer-men|soccer-women|volleyball-women|baseball|softball|icehockey-men|icehockey-women|lacrosse-men|lacrosse-women)$/;
    const allowedPath = /^[\w\-\/]+$/;
    
    if (!allowedSports.test(sport)) {
      return reply.code(400).send({ error: 'Invalid sport parameter' });
    }
    if (!allowedPath.test(path)) {
      return reply.code(400).send({ error: 'Invalid path parameter' });
    }
    
    const ncaaUrl = `https://api.ncaa.com/scoreboard/${encodeURIComponent(sport)}/${encodeURIComponent(path)}`;
    
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
    
    // Validate and sanitize parameters to prevent SSRF
    const allowedSports = /^(football|basketball-men|basketball-women|soccer-men|soccer-women|volleyball-women|baseball|softball|icehockey-men|icehockey-women|lacrosse-men|lacrosse-women)$/;
    const allowedDivision = /^(fbs|fcs|d1|d2|d3)$/;
    const allowedConference = /^[\w\-]+$/;
    
    if (!allowedSports.test(sport)) {
      return reply.code(400).send({ error: 'Invalid sport parameter' });
    }
    if (!allowedDivision.test(division)) {
      return reply.code(400).send({ error: 'Invalid division parameter' });
    }
    if (conference && !allowedConference.test(conference)) {
      return reply.code(400).send({ error: 'Invalid conference parameter' });
    }
    
    const conferencePath = conference ? `/${encodeURIComponent(conference)}` : '';
    const ncaaUrl = `https://api.ncaa.com/standings/${encodeURIComponent(sport)}/${encodeURIComponent(division)}${conferencePath}`;
    
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
