import postgres from 'npm:postgres';
import { config } from './config.ts';

const connectionString = config.databaseUrl;

if (!connectionString) {
  throw new Error('SUPABASE_DB_URL or DATABASE_URL is required');
}

const sql = postgres(connectionString, {
  ssl: config.pgSslMode === 'disable' ? false : 'require',
  max: 1,
  prepare: false,
});

export interface PoolClient {
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
}

export async function dbQuery<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  const run = () => (sql.unsafe as unknown as (query: string, args?: unknown[]) => Promise<T[]>)(text, values as unknown[]);
  try {
    return await run();
  } catch (error) {
    // The DB server drops idle direct connections aggressively; writing on a
    // stale pooled socket throws CONNECTION_CLOSED. A retry re-dials.
    if (error instanceof Error && /CONNECTION_CLOSED|connection closed|ECONNRESET/i.test(error.message)) {
      return await run();
    }
    throw error;
  }
}

// Fetch a large result set in pages. A single query returning thousands of
// rows gets its connection killed mid-transfer on the direct DB host
// (WORKER_RESOURCE_LIMIT / CONNECTION_CLOSED); chunked transfers survive.
export async function dbQueryPaged<T = Record<string, unknown>>(text: string, values: unknown[] = [], pageSize = 400): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; offset < 200_000; offset += pageSize) {
    const page = await dbQuery<T>(`${text} LIMIT ${pageSize} OFFSET ${offset}`, values);
    out.push(...page);
    if (page.length < pageSize) break;
  }
  return out;
}

// PostgREST transport for large reads. The direct pg connection to
// db.<ref>.supabase.co dies mid-transfer on multi-KB result sets from edge
// isolates (CONNECTION_CLOSED / WORKER_RESOURCE_LIMIT); the REST API streams
// the same rows over HTTPS reliably. Params are key/value pairs so filters
// that repeat a key (e.g. two `or=` groups) can be expressed.
export async function restQuery<T = Record<string, unknown>>(
  path: string,
  params: Array<[string, string]> = [],
  pageSize = 1000,
): Promise<T[]> {
  const key = config.supabaseServiceRoleKey;
  if (!config.supabaseUrl || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  // A caller-supplied limit (e.g. "latest row only") means a single fetch;
  // paginating would pull the whole table a page at a time.
  const singlePage = params.some(([k]) => k === 'limit');
  const out: T[] = [];
  for (let offset = 0; offset < 200_000; offset += pageSize) {
    const url = new URL(`${config.supabaseUrl}/rest/v1/${path}`);
    for (const [k, v] of params) url.searchParams.append(k, v);
    url.searchParams.set('offset', String(offset));
    if (!singlePage) url.searchParams.set('limit', String(pageSize));
    const res = await fetch(url, { headers: { apikey: key, authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`rest_query_failed:${res.status} ${(await res.text()).slice(0, 300)}`);
    const rows = (await res.json()) as T[];
    out.push(...rows);
    if (singlePage || rows.length < pageSize) break;
  }
  return out;
}

// PostgREST write transport for payloads too large for the direct pg socket
// (multi-MB JSONB rows die on upload the same way big result sets die on
// download). `prefer` maps to the PostgREST Prefer header — pass
// 'return=representation' to get written rows back.
export async function restWrite<T = Record<string, unknown>>(
  path: string,
  opts: {
    method?: 'POST' | 'PATCH' | 'DELETE';
    params?: Array<[string, string]>;
    body?: unknown;
    prefer?: string;
  } = {},
): Promise<T[]> {
  const key = config.supabaseServiceRoleKey;
  if (!config.supabaseUrl || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  const url = new URL(`${config.supabaseUrl}/rest/v1/${path}`);
  for (const [k, v] of opts.params ?? []) url.searchParams.append(k, v);
  const headers: Record<string, string> = { apikey: key, authorization: `Bearer ${key}` };
  if (opts.prefer) headers.Prefer = opts.prefer;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    method: opts.method ?? 'POST',
    headers,
    body: opts.body === undefined ? null : JSON.stringify(opts.body),
  });
  if (!res.ok) throw new Error(`rest_write_failed:${res.status} ${(await res.text()).slice(0, 300)}`);
  const text = await res.text();
  if (!text) return [] as T[];
  const parsed = JSON.parse(text) as unknown;
  return Array.isArray(parsed) ? (parsed as T[]) : [parsed as T];
}

export async function withDbClient<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
  return await (sql.begin as unknown as <R>(cb: (tx: typeof sql) => Promise<R>) => Promise<R>)(async (tx) => {
    const client: PoolClient = {
      async query<T = Record<string, unknown>>(text: string, values: unknown[] = []) {
        const command = text.trim().toUpperCase();
        if (command === 'BEGIN' || command === 'COMMIT' || command === 'ROLLBACK') {
          return { rows: [] as T[] };
        }
        const rows = await (tx.unsafe as unknown as (query: string, args?: unknown[]) => Promise<T[]>)(text, values as unknown[]);
        return { rows };
      },
    };
    return await handler(client);
  });
}

export async function closeDb(): Promise<void> {
  await sql.end({ timeout: 5 });
}
