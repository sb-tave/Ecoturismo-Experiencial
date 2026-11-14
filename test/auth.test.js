import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupDb, startServer, registerUser, pool, uniq, PASSWORD } from './helpers.js';

let srv;
before(async () => { await setupDb(); srv = await startServer(); });
after(async () => { await srv.close(); await pool.end(); });

const datos = (extra = {}) => ({ nombre: 'Ana Pérez', correo: `ana-${uniq()}@prueba.test`, contrasena: PASSWORD, rol: 'TURISTA', acepta_politica: true, ...extra });

test('RF-01 registro: crea la cuenta sin exponer la contraseña y guarda la aceptación de la política (RF-02)', async () => {
  const body = datos({ correo: `Ana.Mayus-${uniq()}@Prueba.test` });
  const r = await srv.api('POST', '/api/auth/register', { body });
  assert.equal(r.status, 201);
  assert.equal(r.body.usuario.rol, 'TURISTA');
  assert.equal(r.body.usuario.correo, body.correo.toLowerCase());
  assert.equal(r.body.usuario.contrasena_hash, undefined);
  const { rows } = await pool.query('SELECT contrasena_hash, politica_version, politica_aceptada_en FROM usuario WHERE correo = $1', [body.correo.toLowerCase()]);
  assert.notEqual(rows[0].contrasena_hash, PASSWORD);
  assert.match(rows[0].contrasena_hash, /^\$2[aby]\$/); // hash bcrypt
  assert.equal(rows[0].politica_version, 'v1.0');
  assert.ok(rows[0].politica_aceptada_en);
});

test('RF-01 registro: el correo no se puede repetir (sin distinguir mayúsculas)', async () => {
  const body = datos();
  assert.equal((await srv.api('POST', '/api/auth/register', { body })).status, 201);
  const dup = await srv.api('POST', '/api/auth/register', { body: { ...body, correo: body.correo.toUpperCase() } });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, 'CORREO_DUPLICADO');
});

test('RF-01 registro: valida datos, rol permitido y aceptación de la política', async () => {
  const casos = [
    [{ contrasena: 'corta1' }, 'contrasena'],
    [{ contrasena: 'sololetrasaquí' }, 'contrasena'],
    [{ correo: 'no-es-correo' }, 'correo'],
    [{ rol: 'ADMINISTRADOR' }, 'rol'],
    [{ acepta_politica: false }, 'acepta_politica'],
    [{ nombre: '' }, 'nombre'],
  ];
  for (const [extra, campo] of casos) {
    const r = await srv.api('POST', '/api/auth/register', { body: datos(extra) });
    assert.equal(r.status, 400, JSON.stringify(extra));
    assert.equal(r.body.error.code, 'VALIDACION');
    assert.ok(r.body.error.details.some((d) => d.campo === campo), `falta el detalle de ${campo}`);
  }
  const vieja = await srv.api('POST', '/api/auth/register', { body: datos({ politica_version: 'v0.1' }) });
  assert.equal(vieja.status, 409);
  assert.equal(vieja.body.error.code, 'POLITICA_DESACTUALIZADA');
});

test('RF-03 login: devuelve un token JWT y errores genéricos ante credenciales inválidas', async () => {
  const u = await registerUser(srv.api, 'ANFITRION');
  assert.ok(u.token.split('.').length === 3);
  const mala = await srv.api('POST', '/api/auth/login', { body: { correo: u.correo, contrasena: 'OtraClave999' } });
  const noExiste = await srv.api('POST', '/api/auth/login', { body: { correo: `nadie-${uniq()}@prueba.test`, contrasena: PASSWORD } });
  assert.equal(mala.status, 401);
  assert.equal(noExiste.status, 401);
  assert.equal(mala.body.error.message, noExiste.body.error.message); // no revela si el correo existe
});

test('RF-03 rutas protegidas: sin token o con token inválido responden 401', async () => {
  assert.equal((await srv.api('GET', '/api/users/me')).status, 401);
  assert.equal((await srv.api('GET', '/api/users/me', { token: 'abc.def.ghi' })).status, 401);
});

test('RF-03 logout responde correctamente con sesión válida', async () => {
  const u = await registerUser(srv.api);
  const r = await srv.api('POST', '/api/auth/logout', { token: u.token });
  assert.equal(r.status, 200);
});

test('RF-31 una cuenta suspendida no puede iniciar sesión ni usar un token anterior', async () => {
  const u = await registerUser(srv.api);
  await pool.query("UPDATE usuario SET estado = 'SUSPENDIDO' WHERE id_usuario = $1", [u.usuario.id_usuario]);
  const login = await srv.api('POST', '/api/auth/login', { body: { correo: u.correo, contrasena: PASSWORD } });
  assert.equal(login.status, 403);
  assert.equal(login.body.error.code, 'CUENTA_SUSPENDIDA');
  const me = await srv.api('GET', '/api/users/me', { token: u.token });
  assert.equal(me.status, 403);
});

test('RF-02 expone la versión vigente de la política de datos', async () => {
  const r = await srv.api('GET', '/api/auth/policy');
  assert.equal(r.body.version, 'v1.0');
});
