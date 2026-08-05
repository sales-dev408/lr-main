import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withDbClient } from '../db/pool.js';
import { createRedemptionToken, redeemByToken, affirmRedemptionToken } from '../services/redemptionTokens.js';
import { humanDiscountLabel } from '../services/discounts.js';

export async function registerRedemptionRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/api/discounts/tokens',
    { preHandler: fastify.requireRole(['customer']), config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = z.object({ vendorId: z.string().uuid() }).parse(request.body);
      const userId = request.user!.sub;
      const payload = await withDbClient((client) => createRedemptionToken(client, userId, body.vendorId));
      return reply.send(payload);
    },
  );

  fastify.post(
    '/api/discounts/tokens/:token/affirm',
    { preHandler: fastify.requireRole(['customer']), config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const token = (request.params as { token: string }).token;
      const body = z.object({ affirmationName: z.string().min(1) }).parse(request.body);
      const userId = request.user!.sub;
      const result = await affirmRedemptionToken(token, userId, body.affirmationName, request.ip);
      if (!result.ok) {
        return reply.code(409).send({ error: result.error ?? 'Unable to apply discount' });
      }
      return reply.send({
        ok: true,
        discountLabel: result.discount?.description ?? humanDiscountLabel(result.discount?.type ?? 'fixed', result.discount?.value ?? 0),
        amountApplied: result.amountApplied,
        redemptionId: result.redemptionId,
      });
    },
  );

  fastify.get('/redeem/:token', async (request, reply) => {
    const token = (request.params as { token: string }).token;
    const result = await redeemByToken(token, request.ip);
    const html = renderRedemptionPage(result);
    return reply.type('text/html').send(html);
  });
}

function renderRedemptionPage(result: Awaited<ReturnType<typeof redeemByToken>>): string {
  const discountLabel = result.discount?.description ?? humanDiscountLabel(result.discount?.type ?? 'fixed', result.discount?.value ?? 0);
  const amountText = result.ok && result.discount?.type === 'fixed'
    ? `$${(result.amountApplied ?? 0).toFixed(2)}`
    : discountLabel;

  const success = result.ok;
  const title = success ? 'Membership Accepted' : 'Unable to Redeem';
  const message = success
    ? `Light Rail Deals Membership Accepted, apply ${escapeHtml(amountText)} to bill`
    : escapeHtml(result.error ?? 'This QR code is invalid or has already been used.');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: ${success ? '#f0fdf4' : '#fef2f2'};
      color: ${success ? '#14532d' : '#7f1d1d'};
      padding: 24px;
    }
    .card {
      background: #fff;
      border-radius: 24px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.08);
      max-width: 420px;
      width: 100%;
      padding: 40px 28px;
      text-align: center;
    }
    .icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${success ? '#22c55e' : '#ef4444'};
    }
    .icon svg {
      width: 44px;
      height: 44px;
      stroke: #fff;
    }
    h1 {
      font-size: 22px;
      margin: 0 0 12px;
    }
    p {
      font-size: 17px;
      line-height: 1.5;
      margin: 0;
    }
    .sub {
      margin-top: 20px;
      font-size: 13px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      ${success
        ? '<svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'}
    </div>
    <h1>${escapeHtml(title)}</h1>
    <p>${message}</p>
    <p class="sub">${success ? 'Redemption recorded in Light Rail Deals.' : 'Ask the member to refresh their discount QR code.'}</p>
  </div>
</body>
</html>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
