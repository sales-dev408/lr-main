import { dbQuery, restQuery } from './db.ts';
import { config } from './config.ts';

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  details?: { error?: string };
}

// Anonymous device registration: push tokens live in push_devices, keyed by
// the Expo token itself — no account is required or involved.
export async function saveDevicePushToken(token: string | null, platform?: string | null): Promise<void> {
  if (!token) return;
  await dbQuery(
    `INSERT INTO push_devices (expo_push_token, platform, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (expo_push_token) DO UPDATE SET platform = COALESCE($2, push_devices.platform), updated_at = now(), disabled_at = NULL`,
    [token, platform ?? null],
  );
}

export async function removeDevicePushToken(token: string): Promise<void> {
  await dbQuery('DELETE FROM push_devices WHERE expo_push_token = $1', [token]);
}

export async function getAllPushTokens(): Promise<string[]> {
  const rows = await restQuery<{ expo_push_token: string }>('push_devices', [
    ['select', 'expo_push_token'],
    ['disabled_at', 'is.null'],
    ['expo_push_token', 'not.is.null'],
    ['expo_push_token', 'neq.'],
  ]);
  return rows.map((r) => r.expo_push_token);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

// Sends a batch of Expo messages and returns per-token outcomes so callers can
// record deliveries and prune dead tokens.
export async function sendPushNotifications(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<{ sent: number; errors: string[]; deadTokens: string[]; failedTokens: string[] }> {
  if (tokens.length === 0) return { sent: 0, errors: [], deadTokens: [], failedTokens: [] };

  const messages: ExpoMessage[] = tokens.map((token) => {
    const message: ExpoMessage = { to: token, title, body, sound: 'default' };
    if (data) message.data = data;
    return message;
  });

  let sent = 0;
  const errors: string[] = [];
  const deadTokens: string[] = [];
  const failedTokens: string[] = [];

  for (const batch of chunk(messages, 100)) {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    };
    if (config.expoAccessToken) {
      headers.Authorization = `Bearer ${config.expoAccessToken}`;
    }

    try {
      // lgtm[js/server-side-request-forgery]
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers,
        body: JSON.stringify(batch),
      });
      if (response.ok) {
        const payload = (await response.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
        const tickets = Array.isArray(payload?.data) ? payload!.data! : [];
        batch.forEach((message, index) => {
          const ticket = tickets[index];
          if (!ticket || ticket.status === 'ok') {
            sent += 1;
            return;
          }
          if (ticket.details?.error === 'DeviceNotRegistered') {
            deadTokens.push(message.to);
          } else {
            failedTokens.push(message.to);
            errors.push(`${message.to}: ${ticket.details?.error ?? 'ticket error'}`);
          }
        });
        if (tickets.length === 0) {
          // No ticket array returned — count the batch as sent (legacy behavior).
          sent += batch.length;
        }
      } else {
        const text = await response.text().catch(() => 'unknown error');
        errors.push(`Expo push API returned ${response.status}: ${text}`);
        batch.forEach((m) => failedTokens.push(m.to));
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Network error sending push notification');
      batch.forEach((m) => failedTokens.push(m.to));
    }
  }

  // Prune tokens Expo says are no longer registered so future campaigns skip them.
  for (const token of deadTokens) {
    await dbQuery('UPDATE push_devices SET disabled_at = now(), updated_at = now() WHERE expo_push_token = $1', [token]).catch(() => []);
  }

  return { sent, errors, deadTokens, failedTokens };
}

// Admin-triggered campaign: records the campaign, then delivers once per
// eligible device. The push_deliveries ledger (UNIQUE campaign+token) makes
// retries and overlapping sends idempotent — a token that already received the
// campaign is never sent twice.
export async function sendPushCampaign(
  title: string,
  message: string,
  createdBy: string | null,
  campaignKey?: string | null,
): Promise<{ campaignId: string; targeted: number; sent: number; skipped: number; errors: string[] }> {
  const campaignRows = await dbQuery<{ id: string }>(
    `INSERT INTO push_campaigns (campaign_key, title, body, created_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (campaign_key) DO UPDATE SET title = EXCLUDED.title
     RETURNING id`,
    [campaignKey ?? null, title, message, createdBy],
  );
  const campaignId = campaignRows[0]!.id;

  const tokens = await getAllPushTokens();
  if (tokens.length === 0) {
    return { campaignId, targeted: 0, sent: 0, skipped: 0, errors: [] };
  }

  // Ledger pre-registration: only tokens not already delivered for this
  // campaign are claimed (ON CONFLICT DO NOTHING returns claimed rows).
  const claimed: string[] = [];
  for (const token of tokens) {
    const rows = await dbQuery<{ token: string }>(
      `INSERT INTO push_deliveries (campaign_id, expo_push_token, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (campaign_id, expo_push_token) DO NOTHING
       RETURNING expo_push_token AS token`,
      [campaignId, token],
    );
    if (rows.length > 0) claimed.push(token);
  }
  const skipped = tokens.length - claimed.length;

  const result = await sendPushNotifications(claimed, title, message, { type: 'admin_broadcast', campaignId });
  const failed = new Set(result.failedTokens);
  for (const token of claimed) {
    const status = failed.has(token) ? 'failed' : 'sent';
    await dbQuery('UPDATE push_deliveries SET status = $3, sent_at = now() WHERE campaign_id = $1 AND expo_push_token = $2', [campaignId, token, status]).catch(() => []);
  }
  await dbQuery('UPDATE push_campaigns SET sent_count = $2, completed_at = now() WHERE id = $1', [campaignId, result.sent]).catch(() => []);

  return { campaignId, targeted: tokens.length, sent: result.sent, skipped, errors: result.errors };
}
