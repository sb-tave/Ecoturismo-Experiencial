import { readFileSync } from 'node:fs';
import { pool } from '../src/db/pool.js';
import { config } from '../src/config/env.js';

const sql = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');

try {
  await pool.query(sql);
  console.log(`Esquema aplicado en ${new URL(config.databaseUrl).pathname.slice(1)}`);
} catch (err) {
  console.error('No se pudo aplicar el esquema:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
