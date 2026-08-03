import { dbQuery } from '../db/pool.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

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

export async function getPushTokensByCity(city: string): Promise<string[]> {
  const rows = await dbQuery<{ expo_push_token: string }>(
    "SELECT expo_push_token FROM users WHERE city ILIKE $1 AND expo_push_token IS NOT NULL AND expo_push_token <> ''",
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
): Promise<void> {
  if (tokens.length === 0) return;

  const accessToken = process.env.EXPO_ACCESS_TOKEN;
  const messages: ExpoMessage[] = tokens.map((token) => ({
    to: token,
    title,
    body,
    data,
    sound: 'default',
  }));

  for (const batch of chunk(messages, 100)) {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    try {
      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(batch),
      });
    } catch {
      // Failures are best-effort; log and continue.
    }
  }
}
