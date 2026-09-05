import { dbQuery } from './db.ts';
import { config } from './config.ts';

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
}

export async function savePushToken(userId: string, token: string, city?: string | null): Promise<void> {
  await dbQuery(
    'UPDATE users SET expo_push_token = $2, city = COALESCE($3, city) WHERE id = $1',
    [userId, token, city ?? null],
  );
}

export async function getAllPushTokens(): Promise<string[]> {
  const rows = await dbQuery<{ expo_push_token: string }>(
    "SELECT expo_push_token FROM users WHERE expo_push_token IS NOT NULL AND expo_push_token <> ''",
  );
  return rows.map((r) => r.expo_push_token);
}

export async function getPushTokensForNewVendor(): Promise<string[]> {
  const rows = await dbQuery<{ expo_push_token: string }>(
    "SELECT expo_push_token FROM users WHERE expo_push_token IS NOT NULL AND expo_push_token <> '' AND push_enabled_new_vendor = true",
  );
  return rows.map((r) => r.expo_push_token);
}

export async function getPushTokensByCity(city: string): Promise<string[]> {
  const rows = await dbQuery<{ expo_push_token: string }>(
    "SELECT expo_push_token FROM users WHERE city ILIKE $1 AND expo_push_token IS NOT NULL AND expo_push_token <> '' AND push_enabled_local_event = true",
    [city.trim()],
  );
  return rows.map((r) => r.expo_push_token);
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
