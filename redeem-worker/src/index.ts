export interface Env {
  SUPABASE_API_URL: string;
}

interface Discount {
  type: 'fixed' | 'percent' | 'bogo';
  value: number;
  description: string;
  instruction?: string;
}

interface RedeemResult {
  ok: boolean;
  discount?: Discount | null;
  amountApplied?: number;
  redemptionId?: string;
  memberName?: string;
  memberId?: string;
  error?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    const tokenMatch = path.match(/^\/redeem\/([^/]+)$/);
    const isMissing = path === '/redeem';

    if (!tokenMatch && !isMissing) {
      return new Response('Not found', { status: 404 });
    }

    if (isMissing) {
      return new Response(renderMissing(), {
        status: 400,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    const token = tokenMatch![1];
    const apiUrl = `${env.SUPABASE_API_URL.replace(/\/$/, '')}/redeem/${encodeURIComponent(token)}`;
    const result = await fetchRedeem(apiUrl);
    const html = result.ok ? renderSuccess(result) : renderError(result);
    return new Response(html, {
      status: result.ok ? 200 : 400,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  },
};

async function fetchRedeem(apiUrl: string): Promise<RedeemResult> {
  try {
    const res = await fetch(apiUrl, {
      headers: { Accept: 'application/json' },
    });
    const data = (await res.json()) as RedeemResult;
    return data;
  } catch {
    return { ok: false, error: 'Unable to load redemption details. Please try again.' };
  }
}

function discountLabel(result: RedeemResult): string {
  if (result.discount?.description) return result.discount.description;
  const type = result.discount?.type ?? 'fixed';
  const value = result.discount?.value ?? 0;
  if (type === 'fixed') return `$${(result.amountApplied ?? value).toFixed(2)}`;
  if (type === 'percent') return `${value}% off`;
  if (type === 'bogo') return 'Buy one, get one';
  return 'discount';
}

function renderSuccess(result: RedeemResult): string {
  const memberName = escapeHtml(result.memberName ?? 'Member');
  const memberId = escapeHtml(result.memberId ?? '');
  const amount = escapeHtml(discountLabel(result));
  const body = `
    <div class="icon-ring" style="background:linear-gradient(135deg,#16a34a,#22c55e)">
      <div class="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:40px;height:40px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
    </div>
    <h1 class="member-name">${memberName}</h1>
    ${memberId ? `<p class="member-id">Member ID: ${memberId}</p>` : ''}
    <p class="message">Membership approved. Apply <strong>${amount}</strong> to the bill.</p>
    <p class="footer">Redemption recorded in Light Rail Deals.</p>
  `;
  return pageShell('Membership Approved', body, 'success');
}

function renderError(result: RedeemResult): string {
  const title = 'Unable to Apply Discount';
  const message = escapeHtml(result.error ?? 'This QR code is invalid or has already been used.');
  const body = `
    <div class="icon-ring" style="background:linear-gradient(135deg,#dc2626,#ef4444)">
      <div class="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:40px;height:40px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </div>
    </div>
    <h1>${escapeHtml(title)}</h1>
    <p class="message">${message}</p>
    <p class="footer">Ask the member to refresh their discount QR code.</p>
  `;
  return pageShell(title, body, 'error');
}

function renderMissing(): string {
  const title = 'Invalid QR Code';
  const body = `
    <div class="icon-ring" style="background:linear-gradient(135deg,#d97706,#f59e0b)">
      <div class="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:36px;height:36px;"><rect x="3" y="3" width="18" height="18" rx="6" ry="6"></rect><line x1="12" y1="8" x2="12" y2="13"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      </div>
    </div>
    <h1>${escapeHtml(title)}</h1>
    <p class="subtitle">No redemption code was found in this link.</p>
    <p class="message">This QR code appears to be incomplete, expired, or already used. Ask the member to generate a new discount code from the Light Rail Deals app.</p>
    <p class="footer">If the problem continues, contact Light Rail Deals support.</p>
  `;
  return pageShell(title, body, 'neutral');
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
    .message strong { color: ${brandColor}; }
    .member-name { font-size: 26px; font-weight: 800; margin: 0 0 6px; color: #111827; letter-spacing: -0.5px; }
    .member-id { font-size: 15px; font-weight: 500; color: #6b7280; margin: 0 0 22px; letter-spacing: 0.2px; }
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
