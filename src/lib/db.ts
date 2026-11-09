import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __dailyspeakPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!globalThis.__dailyspeakPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    globalThis.__dailyspeakPool = new Pool({
      connectionString,
      // Keep this small on serverless (each instance has its own pool). Default: 3 on Vercel, 10 elsewhere.
      max: Number(process.env.DB_POOL_MAX || (process.env.VERCEL ? 3 : 10)),
      ssl: /supabase|sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
    });
  }
  return globalThis.__dailyspeakPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await getPool().query<T>(text, params);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
