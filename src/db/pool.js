import pg from 'pg';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const { Pool, types } = pg;
types.setTypeParser(1082, (v) => v); // DATE -> 'AAAA-MM-DD' (sin desfases de zona horaria)
types.setTypeParser(1700, (v) => parseFloat(v)); // NUMERIC -> number
types.setTypeParser(20, (v) => parseInt(v, 10)); // BIGINT / COUNT -> number

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.dbPoolMax,
  ssl: config.dbSsl ? { rejectUnauthorized: false } : undefined,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => logger.error({ err }, 'error en una conexión inactiva del pool'));

export const query = (text, params) => pool.query(text, params);

// Ejecuta fn(client) dentro de una transacción. Reintenta ante deadlocks o fallos de serialización.
export async function withTransaction(fn, { retries = 2 } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if (['40001', '40P01'].includes(err.code) && attempt < retries) continue;
      throw err;
    } finally {
      client.release();
    }
  }
}
