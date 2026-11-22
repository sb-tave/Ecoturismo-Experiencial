import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupDb, startServer, registerUser, createAdmin, pool, PASSWORD } from './helpers.js';
import { d, escenario, pagar, reservar } from './fixtures.js';

let srv;
let api;
let admin;
before(async () => { await setupDb(); srv = await startServer(); api = srv.api; admin = await createAdmin(api); });
after(async () => { await srv.close(); await pool.end(); });

const completar = (idReserva) =>
  pool.query("UPDATE reserva SET estado = 'COMPLETADA', fecha_inicio = $2, fecha_fin = $3 WHERE id_reserva = $1", [idReserva, d(-3), d(-1)]);
async function conResena(puntuacion = 2) {
  const esc = await escenario(api, { cupos: 3 });
  const t = await registerUser(api);
  const r = (await reservar(api, t.token, esc.servicio.id_servicio, d(2), d(3))).body;
  await pagar(api, t.token, r.id_reserva);
  await completar(r.id_reserva);
  const k = (await api('POST', `/api/services/${esc.servicio.id_servicio}/reviews`, { token: t.token, body: { id_reserva: r.id_reserva, puntuacion, comentario: 'Comentario ofensivo' } })).body;
  return { ...esc, t, r, k };
}
const detalle = (id, token) => api('GET', `/api/services/${id}`, { token });

test('RF-34 denunciar una publicación o una reseña, con validaciones', async () => {
  const { host, servicio, k } = await conResena();
  const t = await registerUser(api);
  const ok = await api('POST', '/api/complaints', { token: t.token, body: { id_servicio: servicio.id_servicio, motivo: 'Información engañosa' } });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.estado, 'PENDIENTE');
  assert.equal((await api('POST', '/api/complaints', { token: t.token, body: { id_servicio: servicio.id_servicio, motivo: 'Otra vez lo mismo' } })).body.error.code, 'DENUNCIA_DUPLICADA');
  assert.equal((await api('POST', '/api/complaints', { token: host.token, body: { id_calificacion: k.id_calificacion, motivo: 'Lenguaje ofensivo' } })).status, 201);
  assert.equal((await api('POST', '/api/complaints', { token: host.token, body: { id_servicio: servicio.id_servicio, motivo: 'Denuncia propia' } })).body.error.code, 'DENUNCIA_PROPIA');
  assert.equal((await api('POST', '/api/complaints', { token: t.token, body: { motivo: 'Sin objetivo' } })).status, 400);
  assert.equal((await api('POST', '/api/complaints', { token: t.token, body: { id_servicio: 1, id_calificacion: 1, motivo: 'Dos objetivos' } })).status, 400);
  assert.equal((await api('POST', '/api/complaints', { token: t.token, body: { id_servicio: 999999, motivo: 'No existe' } })).status, 404);
  assert.equal((await api('POST', '/api/complaints', { token: admin.token, body: { id_servicio: servicio.id_servicio, motivo: 'El admin no denuncia' } })).status, 403);
  assert.equal((await api('POST', '/api/complaints', { body: { id_servicio: servicio.id_servicio, motivo: 'Sin sesión' } })).status, 401);
});

test('RF-35 el administrador resuelve una denuncia ocultando la publicación; el anfitrión no puede reactivarla', async () => {
  const { host, servicio } = await escenario(api);
  const t = await registerUser(api);
  const den = (await api('POST', '/api/complaints', { token: t.token, body: { id_servicio: servicio.id_servicio, motivo: 'Fotos que no corresponden' } })).body;
  assert.equal((await api('GET', '/api/admin/complaints?estado=PENDIENTE', { token: t.token })).status, 403);
  const cola = await api('GET', '/api/admin/complaints?estado=PENDIENTE&tipo=PUBLICACION', { token: admin.token });
  const fila = cola.body.data.find((x) => x.id_denuncia === den.id_denuncia);
  assert.equal(fila.objetivo.titulo, servicio.titulo);
  assert.equal(fila.denunciante.id_usuario, t.usuario.id_usuario);

  const r = await api('PATCH', `/api/admin/complaints/${den.id_denuncia}`, { token: admin.token, body: { accion: 'OCULTAR' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.estado, 'RESUELTA');
  assert.equal(r.body.id_admin, admin.usuario.id_usuario);
  assert.ok(r.body.fecha_resolucion);
  assert.equal((await detalle(servicio.id_servicio)).status, 404); // el público ya no lo ve
  assert.equal((await detalle(servicio.id_servicio, host.token)).body.estado, 'OCULTO');
  assert.ok(!(await api('GET', `/api/services?q=${encodeURIComponent(servicio.titulo)}`)).body.data.length);
  const reactivar = await api('PATCH', `/api/services/${servicio.id_servicio}`, { token: host.token, body: { estado: 'ACTIVO' } });
  assert.equal(reactivar.status, 403);
  assert.equal(reactivar.body.error.code, 'SERVICIO_OCULTO');
  const avisos = await api('GET', '/api/notifications', { token: host.token });
  assert.ok(avisos.body.data.some((n) => n.tipo === 'CONTENIDO_MODERADO' && n.mensaje.includes('Fotos que no corresponden')));
  assert.equal((await api('PATCH', `/api/admin/complaints/${den.id_denuncia}`, { token: admin.token, body: { accion: 'DESESTIMAR' } })).body.error.code, 'DENUNCIA_ATENDIDA');
});

test('RF-35 desestimar una denuncia deja el contenido como está', async () => {
  const { servicio } = await escenario(api);
  const t = await registerUser(api);
  const den = (await api('POST', '/api/complaints', { token: t.token, body: { id_servicio: servicio.id_servicio, motivo: 'No me gustó' } })).body;
  const r = await api('PATCH', `/api/admin/complaints/${den.id_denuncia}`, { token: admin.token, body: { accion: 'DESESTIMAR' } });
  assert.equal(r.body.estado, 'DESESTIMADA');
  assert.equal((await detalle(servicio.id_servicio)).status, 200);
  assert.equal((await api('PATCH', '/api/admin/complaints/999999', { token: admin.token, body: { accion: 'OCULTAR' } })).status, 404);
});

test('RF-35/RF-33 ocultar una reseña denunciada recalcula el promedio del servicio', async () => {
  const { servicio, t, k } = await conResena(1);
  const antes = await detalle(servicio.id_servicio);
  assert.equal(antes.body.promedio_calificacion, 1);
  const otro = await registerUser(api);
  const den = (await api('POST', '/api/complaints', { token: otro.token, body: { id_calificacion: k.id_calificacion, motivo: 'Insultos al anfitrión' } })).body;
  await api('PATCH', `/api/admin/complaints/${den.id_denuncia}`, { token: admin.token, body: { accion: 'OCULTAR' } });
  const despues = await detalle(servicio.id_servicio);
  assert.equal(despues.body.promedio_calificacion, null);
  assert.equal(despues.body.total_calificaciones, 0);
  assert.equal((await api('GET', `/api/services/${servicio.id_servicio}/reviews`)).body.data.length, 0);
  const avisos = await api('GET', '/api/notifications', { token: t.token });
  assert.ok(avisos.body.data.some((n) => n.tipo === 'CONTENIDO_MODERADO'));
});

test('RF-32 el administrador oculta, restaura y elimina publicaciones indicando el motivo', async () => {
  const { host, servicio } = await escenario(api);
  const id = servicio.id_servicio;
  assert.equal((await api('PATCH', `/api/admin/services/${id}/moderation`, { token: admin.token, body: { accion: 'OCULTAR' } })).status, 400); // falta el motivo
  assert.equal((await api('PATCH', `/api/admin/services/${id}/moderation`, { token: host.token, body: { accion: 'OCULTAR', motivo: 'Intento ajeno' } })).status, 403);
  const oculta = await api('PATCH', `/api/admin/services/${id}/moderation`, { token: admin.token, body: { accion: 'OCULTAR', motivo: 'Contenido inapropiado' } });
  assert.equal(oculta.body.estado, 'OCULTO');
  assert.equal((await api('PATCH', `/api/admin/services/${id}/moderation`, { token: admin.token, body: { accion: 'OCULTAR', motivo: 'Contenido inapropiado' } })).status, 409);
  const listaOcultas = await api('GET', '/api/admin/services?estado=OCULTO', { token: admin.token });
  assert.ok(listaOcultas.body.data.some((x) => x.id_servicio === id));
  const avisos = await api('GET', '/api/notifications', { token: host.token });
  assert.ok(avisos.body.data.some((n) => n.mensaje.includes('Contenido inapropiado')));
  const rest = await api('PATCH', `/api/admin/services/${id}/moderation`, { token: admin.token, body: { accion: 'RESTAURAR' } });
  assert.equal(rest.body.estado, 'ACTIVO');
  assert.equal((await detalle(id)).status, 200);

  // eliminar sin reservas: se borra; con reservas: se oculta
  const del = await api('DELETE', `/api/admin/services/${id}`, { token: admin.token, body: { motivo: 'Publicación fraudulenta' } });
  assert.equal(del.body.eliminado, true);
  assert.equal((await detalle(id, host.token)).status, 404);
  const con = await escenario(api);
  const t = await registerUser(api);
  await reservar(api, t.token, con.servicio.id_servicio, d(2), d(3));
  const del2 = await api('DELETE', `/api/admin/services/${con.servicio.id_servicio}`, { token: admin.token, body: { motivo: 'Publicación fraudulenta' } });
  assert.equal(del2.body.eliminado, false);
  assert.equal(del2.body.estado, 'OCULTO');
});

test('RF-33 el administrador oculta, restaura y elimina reseñas', async () => {
  const { servicio, k } = await conResena(2);
  const base = `/api/admin/reviews/${k.id_calificacion}`;
  assert.equal((await api('GET', `/api/admin/reviews?id_servicio=${servicio.id_servicio}`, { token: admin.token })).body.data.length, 1);
  assert.equal((await api('PATCH', `${base}/moderation`, { token: admin.token, body: { accion: 'OCULTAR', motivo: 'Lenguaje ofensivo' } })).body.estado, 'OCULTA');
  assert.equal((await detalle(servicio.id_servicio)).body.promedio_calificacion, null);
  assert.equal((await api('PATCH', `${base}/moderation`, { token: admin.token, body: { accion: 'OCULTAR', motivo: 'Lenguaje ofensivo' } })).status, 409);
  assert.equal((await api('GET', `/api/admin/reviews?estado=OCULTA&id_servicio=${servicio.id_servicio}`, { token: admin.token })).body.data.length, 1);
  assert.equal((await api('PATCH', `${base}/moderation`, { token: admin.token, body: { accion: 'RESTAURAR' } })).body.estado, 'VISIBLE');
  assert.equal((await detalle(servicio.id_servicio)).body.promedio_calificacion, 2);
  assert.equal((await api('DELETE', base, { token: admin.token, body: { motivo: 'Spam repetido' } })).status, 200);
  assert.equal((await detalle(servicio.id_servicio)).body.promedio_calificacion, null);
  assert.equal((await api('DELETE', base, { token: admin.token, body: { motivo: 'Spam repetido' } })).status, 404);
});

test('RF-31 el administrador lista usuarios y suspende o reactiva cuentas', async () => {
  const { host, servicio } = await escenario(api);
  const t = await registerUser(api);
  const todos = await api('GET', '/api/admin/users?rol=ANFITRION&q=anfitrion', { token: admin.token });
  assert.ok(todos.body.data.some((u) => u.id_usuario === host.usuario.id_usuario));
  assert.ok(todos.body.data.every((u) => u.rol === 'ANFITRION' && u.contrasena_hash === undefined));
  assert.equal((await api('GET', '/api/admin/users', { token: t.token })).status, 403);

  const sus = await api('PATCH', `/api/admin/users/${host.usuario.id_usuario}/status`, { token: admin.token, body: { estado: 'SUSPENDIDO' } });
  assert.equal(sus.body.estado, 'SUSPENDIDO');
  assert.equal((await api('POST', '/api/auth/login', { body: { correo: host.correo, contrasena: PASSWORD } })).status, 403);
  assert.equal((await api('POST', '/api/services', { token: host.token, body: {} })).status, 403); // no puede publicar
  assert.equal((await detalle(servicio.id_servicio)).status, 404); // sus publicaciones salen del catálogo
  assert.equal((await reservar(api, t.token, servicio.id_servicio, d(2), d(3))).body.error.code, 'SERVICIO_NO_DISPONIBLE'); // no se puede reservar
  assert.equal((await api('GET', '/api/admin/users?estado=SUSPENDIDO', { token: admin.token })).body.data.length >= 1, true);

  const react = await api('PATCH', `/api/admin/users/${host.usuario.id_usuario}/status`, { token: admin.token, body: { estado: 'ACTIVO' } });
  assert.equal(react.body.estado, 'ACTIVO');
  assert.equal((await detalle(servicio.id_servicio)).status, 200);
  assert.equal((await reservar(api, t.token, servicio.id_servicio, d(2), d(3))).status, 201);

  assert.equal((await api('PATCH', `/api/admin/users/${admin.usuario.id_usuario}/status`, { token: admin.token, body: { estado: 'SUSPENDIDO' } })).body.error.code, 'CUENTA_PROPIA');
  const otroAdmin = await createAdmin(api);
  assert.equal((await api('PATCH', `/api/admin/users/${otroAdmin.usuario.id_usuario}/status`, { token: admin.token, body: { estado: 'SUSPENDIDO' } })).body.error.code, 'ADMIN_PROTEGIDO');
  assert.equal((await api('PATCH', '/api/admin/users/999999/status', { token: admin.token, body: { estado: 'SUSPENDIDO' } })).status, 404);
});
