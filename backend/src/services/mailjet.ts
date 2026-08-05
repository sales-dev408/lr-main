import { config } from '../config.js';
import { normalizePhone } from '../utils/phone.js';

export interface VendorWelcomeEmailInput {
  to: string;
  vendorName: string;
  qrCodeUrl: string;
  discountLabel: string;
  setupUrl: string;
}

export interface BlastRecipient {
  email: string | null;
  phone: string | null;
}

export interface DealOfTheDayBlastInput {
  subject: string;
  text: string;
  html?: string | undefined;
  smsText?: string | undefined;
  recipients: BlastRecipient[];
}

export async function sendVendorWelcomeEmail(input: VendorWelcomeEmailInput): Promise<void> {
  if (!config.mailjetApiKey || !config.mailjetSecretApiKey) {
    console.warn('[mailjet] Mailjet credentials not configured; skipping welcome email.');
    return;
  }

  const auth = Buffer.from(`${config.mailjetApiKey}:${config.mailjetSecretApiKey}`).toString('base64');
  const subject = `Welcome to Light Rail Deals, ${input.vendorName}`;
  const text = [
    `Welcome to Light Rail Deals, ${input.vendorName}!`,
    '',
    `Your exclusive member discount is: ${input.discountLabel}.`,
    '',
    'Print the QR code below and display it at your register. Members will scan it with the Light Rail Deals app to confirm their membership and view your discount.',
    '',
    `QR code image: ${input.qrCodeUrl}`,
    '',
    `Setup instructions: ${input.setupUrl}`,
    '',
    'Learn more at https://lightraildeals.com',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f8;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:18px;overflow:hidden;max-width:600px;width:100%;">
          <tr>
            <td style="background:#2563eb;padding:32px 24px;text-align:center;">
              <a href="https://lightraildeals.com" style="color:#ffffff;text-decoration:none;font-size:24px;font-weight:800;">Light Rail Deals</a>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px;">
              <h1 style="color:#0e1b2a;font-size:22px;margin:0 0 16px;">Welcome, ${escapeHtml(input.vendorName)}</h1>
              <p style="color:#52617a;font-size:16px;line-height:1.5;">
                You&apos;re now a participating Light Rail Deals business. Your exclusive member discount is <strong style="color:#0e1b2a;">${escapeHtml(input.discountLabel)}</strong>.
              </p>
              <p style="color:#52617a;font-size:16px;line-height:1.5;">
                Print the QR code below and display it where members can scan it in-store. Members using the Light Rail Deals app will scan this code to confirm their membership and see your discount.
              </p>
              <div style="text-align:center;margin:32px 0;background:#f8fafc;border-radius:16px;padding:24px;">
                <img src="${escapeHtml(input.qrCodeUrl)}" alt="Your vendor QR code" width="240" height="240" style="border-radius:12px;">
                <p style="color:#7c8a9d;font-size:13px;margin:12px 0 0;">Display this code in-store for members to scan.</p>
              </div>
              <p style="color:#52617a;font-size:16px;line-height:1.5;">
                Need help? Visit <a href="https://lightraildeals.com" style="color:#2563eb;text-decoration:underline;">lightraildeals.com</a> or your vendor setup page: <a href="${escapeHtml(input.setupUrl)}" style="color:#2563eb;text-decoration:underline;">${escapeHtml(input.setupUrl)}</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:24px;text-align:center;color:#7c8a9d;font-size:12px;">
              <a href="https://lightraildeals.com" style="color:#7c8a9d;text-decoration:none;">Light Rail Deals</a>
              &nbsp;·&nbsp;
              <a href="https://www.lightraildeals.com/privacy-policy.html" style="color:#7c8a9d;text-decoration:none;">Privacy Policy - Light Rail Deals</a>
              &nbsp;·&nbsp;
              <a href="https://www.lightraildeals.com/terms-of-use.html" style="color:#7c8a9d;text-decoration:none;">Terms of Use</a>
              &nbsp;·&nbsp;
              <a href="https://www.lightraildeals.com/eula.html" style="color:#7c8a9d;text-decoration:none;">EULA</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const response = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: config.mailjetFromEmail, Name: config.mailjetFromName },
          To: [{ Email: input.to }],
          Subject: subject,
          TextPart: text,
          HTMLPart: html,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => 'unknown');
    throw new Error(`Mailjet send failed (${response.status}): ${body}`);
  }
}

export async function sendDealOfTheDayBlast(input: DealOfTheDayBlastInput): Promise<{ emails: number; sms: number; errors: string[] }> {
  const errors: string[] = [];
  let emails = 0;
  let sms = 0;

  const emailRecipients = input.recipients.filter((r) => r.email && r.email.includes('@'));
  if (emailRecipients.length > 0) {
    try {
      emails = await sendMailjetEmailBatch(input.subject, input.text, input.html, emailRecipients.map((r) => r.email!));
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Email batch failed');
    }
  }

  if (input.smsText) {
    const phoneRecipients = input.recipients.filter((r) => r.phone && normalizePhone(r.phone));
    for (const recipient of phoneRecipients) {
      try {
        await sendMailjetSms(input.smsText, recipient.phone!);
        sms += 1;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : `SMS to ${recipient.phone} failed`);
      }
    }
  }

  return { emails, sms, errors };
}

async function sendMailjetEmailBatch(subject: string, text: string, html: string | undefined, toList: string[]): Promise<number> {
  if (!config.mailjetApiKey || !config.mailjetSecretApiKey) {
    throw new Error('Mailjet API credentials are not configured');
  }

  const auth = Buffer.from(`${config.mailjetApiKey}:${config.mailjetSecretApiKey}`).toString('base64');
  const messages = toList.map((to) => ({
    From: { Email: config.mailjetFromEmail, Name: config.mailjetFromName },
    To: [{ Email: to }],
    Subject: subject,
    TextPart: text,
    HTMLPart: html || text.replace(/\n/g, '<br>'),
  }));

  const response = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ Messages: messages }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => 'unknown');
    throw new Error(`Mailjet send failed (${response.status}): ${body}`);
  }

  return toList.length;
}

async function sendMailjetSms(text: string, to: string): Promise<void> {
  if (!config.mailjetSmsToken) {
    throw new Error('Mailjet SMS token is not configured');
  }

  const phone = normalizePhone(to);
  if (!phone) {
    throw new Error(`Invalid phone number: ${to}`);
  }

  const response = await fetch('https://api.mailjet.com/v4/sms-send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.mailjetSmsToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ From: 'LightRail', To: phone, Text: text }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => 'unknown');
    throw new Error(`Mailjet SMS failed (${response.status}): ${body}`);
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
