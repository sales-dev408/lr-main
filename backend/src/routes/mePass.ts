import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dbQuery, withDbClient } from '../db/pool.js';
import { generateOpaqueToken } from '../utils/ids.js';

async function getOrCreateMembershipPass(userId: string) {
  const membershipRows = await dbQuery<{ id: string }>(
    'SELECT id FROM cards WHERE is_membership = true AND status = $1 LIMIT 1',
    ['active'],
  );
  const cardId = membershipRows[0]?.id;
  if (!cardId) {
    throw new Error('No active membership card');
  }

  const existing = await dbQuery<{
    id: string;
    serial_number: string;
    lookup_token: string;
    barcode_value: string | null;
    card_id: string;
  }>('SELECT id, serial_number, lookup_token, barcode_value, card_id FROM passes WHERE user_id = $1 LIMIT 1', [userId]);

  if (existing[0]) {
    const row = existing[0];
    return {
      pass: {
        passId: row.id,
        serialNumber: row.serial_number,
        lookupToken: row.lookup_token,
        barcodeValue: row.barcode_value ?? row.lookup_token,
        cardId: row.card_id,
      },
      walletUrl: null,
      androidUrl: null,
      passUrl: null,
      downloadUrl: '',
    };
  }

  const serialNumber = generateOpaqueToken(12);
  const lookupToken = generateOpaqueToken(18);
  const authToken = generateOpaqueToken(18);

  const rows = await withDbClient(async (client) => {
    const result = await client.query<{
      id: string;
      serial_number: string;
      lookup_token: string;
      barcode_value: string | null;
      card_id: string;
    }>(
      `
        INSERT INTO passes (user_id, card_id, platform, serial_number, auth_token, lookup_token, barcode_value)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, serial_number, lookup_token, barcode_value, card_id
      `,
      [userId, cardId, 'google', serialNumber, authToken, lookupToken, lookupToken],
    );
    return result.rows;
  });

  const row = rows[0]!;
  return {
    pass: {
      passId: row.id,
      serialNumber: row.serial_number,
      lookupToken: row.lookup_token,
      barcodeValue: row.barcode_value ?? row.lookup_token,
      cardId: row.card_id,
    },
    walletUrl: null,
    androidUrl: null,
    passUrl: null,
    downloadUrl: '',
  };
}

export async function registerMePassRoutes(fastify: FastifyInstance): Promise<void> {
  const bodySchema = z.object({ platform: z.enum(['apple', 'google']).optional() });

  fastify.get('/api/me/pass', { preHandler: fastify.requireRole(['customer']), config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    try {
      const result = await getOrCreateMembershipPass(request.user!.sub);
      return reply.send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load pass';
      return reply.code(500).send({ error: message });
    }
  });

  fastify.post('/api/me/pass', { preHandler: fastify.requireRole(['customer']), config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    try {
      bodySchema.parse(request.body);
      const result = await getOrCreateMembershipPass(request.user!.sub);
      return reply.send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create pass';
      return reply.code(500).send({ error: message });
    }
  });
}
