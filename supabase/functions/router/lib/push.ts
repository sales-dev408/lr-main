import { dbQuery, restQuery } from './db.ts';
import { config } from './config.ts';

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
}

export async function savePushToken(userId: string, token: string | null, city?: string | null): Promise<void> {
  await dbQuery(
    'UPDATE users SET expo_push_token = $2, city = COALESCE($3, city) WHERE id = $1',
    [userId, token, city ?? null],
  );
}

// Token lists can be thousands of rows — read via PostgREST since the direct
// pg connection dies mid-transfer on multi-KB result sets from edge isolates.
async function pushTokensWhere(extraParams: Array<[string, string]>): Promise<string[]> {
  const rows = await restQuery<{ expo_push_token: string }>('users', [
    ['select', 'expo_push_token'],
    ['expo_push_token', 'not.is.null'],
    ['expo_push_token', 'neq.'],
    ...extraParams,
  ]);
  return rows.map((r) => r.expo_push_token);
}

export async function getAllPushTokens(): Promise<string[]> {
  return pushTokensWhere([]);
}

export async function getPushTokensForNewVendor(): Promise<string[]> {
  return pushTokensWhere([['push_enabled_new_vendor', 'eq.true']]);
}

export async function getPushTokensByCity(city: string): Promise<string[]> {
  return pushTokensWhere([
    ['city', `ilike.${city.trim().replace(/[,()]/g, '')}`],
    ['push_enabled_local_event', 'eq.true'],
  ]);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export async function sendPushNotifications(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<{ sent: number; errors: string[] }> {
  if (tokens.length === 0) return { sent: 0, errors: [] };

  const messages: ExpoMessage[] = tokens.map((token) => {
    const message: ExpoMessage = { to: token, title, body, sound: 'default' };
    if (data) message.data = data;
    return message;
  });

  let sent = 0;
  const errors: string[] = [];

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
        sent += batch.length;
      } else {
        const text = await response.text().catch(() => 'unknown error');
        errors.push(`Expo push API returned ${response.status}: ${text}`);
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Network error sending push notification');
    }
  }

  return { sent, errors };
}
