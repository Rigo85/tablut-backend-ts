import { Pool } from 'pg';
import { config } from './config';
import { logger } from './logger';

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) throw new Error('PG pool not initialized - call pgConnect() first');
  return pool;
}

export function pgIsConnected(): boolean {
  return !!pool;
}

export async function pgPing(): Promise<void> {
  await getPool().query('SELECT 1');
}

export async function pgConnect(): Promise<void> {
  pool = new Pool({ connectionString: config.pgUrl });
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    logger.info({ ns: 'pg', ev: 'connected' });
  } finally {
    client.release();
  }
}

export async function pgDisconnect(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = undefined;
  logger.info({ ns: 'pg', ev: 'disconnected' });
}
