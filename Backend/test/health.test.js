import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupDb, startServer, pool } from './helpers.js';

let srv;
before(async () => { await setupDb(); srv = await startServer(); });
after(async () => { await srv.close(); await pool.end(); });

test('GET /health responde ok', async () => {
  const r = await srv.api('GET', '/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'ok');
});

test('GET /health/ready verifica la base de datos', async () => {
  const r = await srv.api('GET', '/health/ready');
  assert.equal(r.status, 200);
});

test('rutas inexistentes devuelven el formato de error estándar', async () => {
  const r = await srv.api('GET', '/api/no-existe');
  assert.equal(r.status, 404);
  assert.equal(r.body.error.code, 'RUTA_NO_ENCONTRADA');
});

test('JSON inválido devuelve 400', async () => {
  const res = await fetch(`${srv.base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{malo' });
  assert.equal(res.status, 400);
});
