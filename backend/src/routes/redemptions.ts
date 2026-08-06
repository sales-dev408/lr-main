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

  fastify.get('/redeem', async (_request, reply) => {
    return reply.type('text/html').send(renderMissingTokenPage());
  });

  fastify.get('/redeem/:token', async (request, reply) => {
    const token = (request.params as { token: string }).token;
    const result = await redeemByToken(token, request.ip);
    const html = renderRedemptionPage(result);
    return reply.type('text/html').send(html);
  });
}

function renderRedemptionPage(result: Awaited<ReturnType<typeof redeemByToken>>): string {
  const success = result.ok;
  const title = success ? 'Membership Accepted' : 'Unable to Redeem';
  const discountLabel = result.discount?.description ?? humanDiscountLabel(result.discount?.type ?? 'fixed', result.discount?.value ?? 0);

  let discountAmount = discountLabel;
  if (success) {
    if (result.discount?.type === 'fixed') {
      discountAmount = `$${(result.amountApplied ?? 0).toFixed(2)}`;
    } else if (result.discount?.type === 'percent') {
      discountAmount = `${result.discount.value}% off`;
    }
  }

  const errorMessage = escapeHtml(result.error ?? 'This QR code is invalid or has already been used.');
  const redemptionId = result.redemptionId ? escapeHtml(result.redemptionId) : '';

  const icon = success
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:40px;height:40px;"><polyline points="20 6 9 17 4 12"></polyline></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:40px;height:40px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

  const bodyContent = `
    <div class="icon-ring" style="background:${success ? 'linear-gradient(135deg,#16a34a,#22c55e)' : 'linear-gradient(135deg,#dc2626,#ef4444)'}">
      <div class="icon">${icon}</div>
    </div>
    <h1>${escapeHtml(title)}</h1>
    ${success ? '<p class="subtitle">Show this screen to the vendor.</p>' : ''}
    <p class="message">${success ? 'Light Rail Deals Membership Accepted' : errorMessage}</p>
    ${success ? `<p class="amount">Applied discount amount: <span>${escapeHtml(discountAmount)}</span></p>` : ''}
    ${success && redemptionId ? `<p class="tracking">Tracking ID: <code>${redemptionId}</code></p>` : ''}
    ${success && result.discount?.instruction ? `<p class="instruction">${escapeHtml(result.discount.instruction)}</p>` : ''}
    <p class="footer">${success ? 'Redemption recorded in Light Rail Deals.' : 'Ask the member to refresh their discount QR code.'}</p>
  `;

  return pageShell(title, bodyContent, success ? 'success' : 'error');
}

function renderMissingTokenPage(): string {
  const title = 'Invalid QR Code';
  const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:36px;height:36px;"><rect x="3" y="3" width="18" height="18" rx="6" ry="6"></rect><line x1="12" y1="8" x2="12" y2="13"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

  const bodyContent = `
    <div class="icon-ring" style="background:linear-gradient(135deg,#d97706,#f59e0b)">
      <div class="icon">${icon}</div>
    </div>
    <h1>${title}</h1>
    <p class="subtitle">No redemption code was found in this link.</p>
    <p class="message">This QR code appears to be incomplete, expired, or already used. Ask the member to generate a new discount code from the Light Rail Deals app.</p>
    <p class="footer">If the problem continues, contact Light Rail Deals support.</p>
  `;

  return pageShell(title, bodyContent, 'neutral');
}

function pageShell(title: string, body: string, tone: 'success' | 'error' | 'neutral'): string {
  const brandColor = tone === 'success' ? '#16a34a' : tone === 'error' ? '#dc2626' : '#d97706';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: radial-gradient(circle at 50% 0%, #1e293b 0%, #0f172a 100%);
      color: #1f2937;
      padding: 24px;
    }
    .card {
      background: #ffffff;
      border-radius: 28px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.25);
      max-width: 460px;
      width: 100%;
      padding: 44px 32px 36px;
      text-align: center;
      overflow: hidden;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 28px;
      font-size: 15px;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.2px;
    }
    .brand svg { width: 22px; height: 22px; }
    .icon-ring {
      width: 92px;
      height: 92px;
      margin: 0 auto 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    }
    .icon { display: flex; align-items: center; justify-content: center; }
    h1 { font-size: 26px; font-weight: 800; margin: 0 0 8px; color: #111827; letter-spacing: -0.5px; }
    .subtitle { font-size: 15px; color: #6b7280; margin: 0 0 22px; line-height: 1.45; }
    .message { font-size: 16px; line-height: 1.6; margin: 0 0 18px; color: #4b5563; }
    .amount { font-size: 17px; font-weight: 600; color: #111827; margin: 0 0 8px; }
    .amount span { color: ${brandColor}; }
    .tracking { font-size: 13px; color: #6b7280; margin: 0 0 24px; word-break: break-all; }
    .tracking code { background: #f3f4f6; border-radius: 6px; padding: 3px 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #111827; }
    .instruction { font-size: 14px; color: #374151; background: #f9fafb; border-radius: 14px; padding: 14px 18px; margin: 0 0 22px; line-height: 1.55; border: 1px solid #f3f4f6; }
    .footer { font-size: 12px; color: #9ca3af; margin: 0; }
    @media (max-width: 480px) {
      .card { padding: 32px 22px 28px; border-radius: 22px; }
      h1 { font-size: 22px; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <svg viewBox="0 0 24 24" fill="none" stroke="${brandColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="8" rx="2"></rect><path d="M4 12h2l2-3 3 6 3-6 2 3h3"></path></svg>
      Light Rail Deals
    </div>
    ${body}
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
