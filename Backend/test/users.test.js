import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupDb, startServer, registerUser, pool, PASSWORD } from './helpers.js';

let srv;
before(async () => { await setupDb(); srv = await startServer(); });
after(async () => { await srv.close(); await pool.end(); });

test('RF-05 consultar y actualizar el perfil propio', async () => {
  const u = await registerUser(srv.api);
  const me = await srv.api('GET', '/api/users/me', { token: u.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.correo, u.correo);
  const upd = await srv.api('PATCH', '/api/users/me', { token: u.token, body: { nombre: 'Nombre Nuevo', telefono: '3001234567' } });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.nombre, 'Nombre Nuevo');
  assert.equal(upd.body.telefono, '3001234567');
  const vacio = await srv.api('PATCH', '/api/users/me', { token: u.token, body: {} });
  assert.equal(vacio.status, 400);
});

test('RF-05 cambiar la contraseña exige la actual', async () => {
  const u = await registerUser(srv.api);
  const mala = await srv.api('PATCH', '/api/users/me/password', { token: u.token, body: { contrasena_actual: 'Incorrecta1', contrasena_nueva: 'NuevaClave456' } });
  assert.equal(mala.status, 403);
  const ok = await srv.api('PATCH', '/api/users/me/password', { token: u.token, body: { contrasena_actual: PASSWORD, contrasena_nueva: 'NuevaClave456' } });
  assert.equal(ok.status, 200);
  const viejo = await srv.api('POST', '/api/auth/login', { body: { correo: u.correo, contrasena: PASSWORD } });
  assert.equal(viejo.status, 401);
  const nuevo = await srv.api('POST', '/api/auth/login', { body: { correo: u.correo, contrasena: 'NuevaClave456' } });
  assert.equal(nuevo.status, 200);
});

test('RNF-07 eliminar la cuenta anonimiza los datos personales', async () => {
  const u = await registerUser(srv.api);
  const mala = await srv.api('DELETE', '/api/users/me', { token: u.token, body: { contrasena: 'Incorrecta1' } });
  assert.equal(mala.status, 403);
  const ok = await srv.api('DELETE', '/api/users/me', { token: u.token, body: { contrasena: PASSWORD } });
  assert.equal(ok.status, 200);
  const { rows } = await pool.query('SELECT nombre, correo, telefono, estado, eliminado_en FROM usuario WHERE id_usuario = $1', [u.usuario.id_usuario]);
  assert.equal(rows[0].estado, 'ELIMINADO');
  assert.equal(rows[0].nombre, 'Usuario eliminado');
  assert.notEqual(rows[0].correo, u.correo);
  assert.equal(rows[0].telefono, null);
  assert.ok(rows[0].eliminado_en);
  assert.equal((await srv.api('POST', '/api/auth/login', { body: { correo: u.correo, contrasena: PASSWORD } })).status, 401);
  assert.equal((await srv.api('GET', '/api/users/me', { token: u.token })).status, 401);
});
