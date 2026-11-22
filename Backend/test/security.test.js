import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env.js';
import { setupDb, startServer, registerUser, createCategory, pool } from './helpers.js';

let srv;
let api;
before(async () => { await setupDb(); srv = await startServer(); api = srv.api; });
after(async () => { await srv.close(); await pool.end(); });

const raiz = new URL('..', import.meta.url).pathname;
// Ejecuta un script en un proceso aparte para probar configuraciones que se leen al arrancar (límites, HTTPS).
const enProcesoAparte = (script, env) => {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: raiz, env: { ...process.env, NODE_ENV: 'test', ...env }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout.trim().split('\n').pop());
};

test('RNF-04 cabeceras de seguridad (helmet) y sin x-powered-by', async () => {
  const res = await fetch(`${srv.base}/health`);
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(res.headers.get('strict-transport-security'));
});

test('RNF-04 CORS: solo los orígenes configurados reciben permiso', async () => {
  const permitido = await fetch(`${srv.base}/api/categories`, { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(permitido.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const ajeno = await fetch(`${srv.base}/api/categories`, { headers: { Origin: 'http://sitio-malicioso.example' } });
  assert.equal(ajeno.headers.get('access-control-allow-origin'), null);
});

test('OWASP A03 la inyección SQL no tiene efecto (consultas parametrizadas y validación)', async () => {
  const intentos = ["' OR 1=1 --", "'; DROP TABLE usuario; --", '%', '_', "\\' OR ''='"];
  for (const q of intentos) {
    const r = await api('GET', `/api/services?q=${encodeURIComponent(q)}&localidad=${encodeURIComponent(q)}`);
    assert.equal(r.status, 200, `q=${q}`);
    assert.deepEqual(r.body.data, []);
  }
  const login = await api('POST', '/api/auth/login', { body: { correo: "' OR '1'='1", contrasena: "' OR '1'='1" } });
  assert.equal(login.status, 400);
  const { rows } = await pool.query("SELECT to_regclass('public.usuario') AS tabla");
  assert.equal(rows[0].tabla, 'usuario');
});

test('OWASP A02/A07 tokens manipulados, firmados con otra clave, vencidos o de usuarios inexistentes se rechazan', async () => {
  const u = await registerUser(api);
  const sinFirma = jwt.sign({ sub: String(u.usuario.id_usuario), rol: 'ADMINISTRADOR' }, '', { algorithm: 'none' });
  const otraClave = jwt.sign({ sub: String(u.usuario.id_usuario), rol: 'ADMINISTRADOR' }, 'otra-clave-distinta-que-no-es-la-real-0000');
  const vencido = jwt.sign({ sub: String(u.usuario.id_usuario), rol: 'TURISTA' }, config.jwt.secret, { expiresIn: -10 });
  const fantasma = jwt.sign({ sub: '99999999', rol: 'TURISTA' }, config.jwt.secret);
  for (const token of [sinFirma, otraClave, vencido, fantasma, 'basura']) {
    assert.equal((await api('GET', '/api/users/me', { token })).status, 401);
  }
  // el rol de un token válido no se toma del token: siempre se consulta en la base
  const escalado = jwt.sign({ sub: String(u.usuario.id_usuario), rol: 'ADMINISTRADOR' }, config.jwt.secret);
  assert.equal((await api('GET', '/api/admin/users', { token: escalado })).status, 403);
});

test('OWASP A01 asignación masiva: no se puede cambiar el rol ni el estado desde el perfil', async () => {
  const u = await registerUser(api);
  const r = await api('PATCH', '/api/users/me', { token: u.token, body: { nombre: 'Nombre Válido', rol: 'ADMINISTRADOR', estado: 'ACTIVO', id_usuario: 1 } });
  assert.equal(r.status, 200);
  assert.equal(r.body.rol, 'TURISTA');
  assert.equal(r.body.id_usuario, u.usuario.id_usuario);
  const reg = await api('POST', '/api/auth/register', { body: { nombre: 'Intruso', correo: `intruso-${Date.now()}@prueba.test`, contrasena: 'Clave12345', rol: 'TURISTA', acepta_politica: true, estado: 'ACTIVO', id_usuario: 1 } });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.usuario.rol, 'TURISTA');
});

test('OWASP A04 el cuerpo de las solicitudes tiene un tamaño máximo', async () => {
  const res = await fetch(`${srv.base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: 'a@b.co', contrasena: 'x'.repeat(200_000) }) });
  assert.equal(res.status, 413);
});

test('RNF-09 los errores internos no filtran detalles técnicos', async () => {
  const cat = await createCategory('Errores');
  assert.ok(cat);
  const r = await api('GET', '/api/services/abc');
  assert.equal(r.status, 400);
  assert.ok(!JSON.stringify(r.body).includes('select'));
  assert.equal((await api('GET', '/api/services/99999999999999999999')).status, 400);
});

test('OWASP A07 el inicio de sesión limita los intentos por IP (fuerza bruta)', () => {
  const script = `
    import { createApp } from './src/app.js';
    import { pool } from './src/db/pool.js';
    const server = createApp().listen(0, async () => {
      const base = 'http://127.0.0.1:' + server.address().port;
      const codigos = [];
      for (let i = 0; i < 5; i += 1) {
        const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: 'x@y.co', contrasena: 'mala' }) });
        codigos.push(r.status);
      }
      console.log(JSON.stringify(codigos));
      server.close(); await pool.end(); process.exit(0);
    });`;
  const codigos = enProcesoAparte(script, { RATE_LIMIT_ENABLED: 'true', RATE_LIMIT_AUTH: '3' });
  assert.deepEqual(codigos, [401, 401, 401, 429, 429]);
});

test('RNF-01 en producción el tráfico HTTP se redirige a HTTPS (excepto /health)', () => {
  const script = `
    import { createApp } from './src/app.js';
    import { pool } from './src/db/pool.js';
    const server = createApp().listen(0, async () => {
      const base = 'http://127.0.0.1:' + server.address().port;
      const api = await fetch(base + '/api/categories', { redirect: 'manual' });
      const health = await fetch(base + '/health', { redirect: 'manual' });
      console.log(JSON.stringify({ api: api.status, location: api.headers.get('location'), health: health.status }));
      server.close(); await pool.end(); process.exit(0);
    });`;
  const r = enProcesoAparte(script, { FORCE_HTTPS: 'true' });
  assert.equal(r.api, 308);
  assert.match(r.location, /^https:\/\/127\.0\.0\.1:\d+\/api\/categories$/);
  assert.equal(r.health, 200);
});
