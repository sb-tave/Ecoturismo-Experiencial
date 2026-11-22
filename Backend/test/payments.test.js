import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupDb, startServer, registerUser, createAdmin, pool } from './helpers.js';
import { outbox } from '../src/services/mailer.js';
import { cupos, d, escenario, pagar, reservar } from './fixtures.js';

let srv;
let api;
before(async () => { await setupDb(); srv = await startServer(); api = srv.api; });
after(async () => { await srv.close(); await pool.end(); });

const nueva = async (opts) => {
  const esc = await escenario(api, opts);
  const t = await registerUser(api);
  const r = (await reservar(api, t.token, esc.servicio.id_servicio, d(2), d(4))).body;
  return { ...esc, t, r };
};

test('RF-26/RF-27 un pago aprobado confirma la reserva con el monto calculado por el backend', async () => {
  const { t, r, servicio } = await nueva({ precio: 90000 });
  const p = await api('POST', '/api/payments/simulate', { token: t.token, body: { id_reserva: r.id_reserva, metodo: 'TARJETA_SIMULADA', resultado: 'APROBADO', monto: 1 } });
  assert.equal(p.status, 201, JSON.stringify(p.body));
  assert.equal(p.body.pago.estado, 'APROBADO');
  assert.equal(p.body.pago.monto, 180000); // 2 noches; el "monto" que envía el cliente se ignora
  assert.match(p.body.pago.referencia_pasarela, /^SIM-[0-9A-F]{8}$/);
  assert.equal(p.body.reserva.estado, 'CONFIRMADA');
  assert.equal(p.body.reserva.expira_en, null);
  assert.deepEqual(await cupos(api, servicio.id_servicio, d(2), d(3)), [0, 0]); // los cupos siguen ocupados
  const detalle = await api('GET', `/api/bookings/${r.id_reserva}`, { token: t.token });
  assert.equal(detalle.body.estado, 'CONFIRMADA');
  assert.equal(detalle.body.pagos.length, 1);
});

test('RF-27 un pago rechazado no confirma la reserva y se puede reintentar', async () => {
  const { t, r } = await nueva();
  const mal = await pagar(api, t.token, r.id_reserva, 'RECHAZADO');
  assert.equal(mal.status, 201);
  assert.equal(mal.body.pago.estado, 'RECHAZADO');
  assert.equal(mal.body.reserva.estado, 'PENDIENTE_PAGO');
  const lista = await api('GET', '/api/bookings', { token: t.token });
  assert.equal(lista.body.data[0].estado_pago, 'RECHAZADO');
  const bien = await pagar(api, t.token, r.id_reserva, 'APROBADO', 'TRANSFERENCIA_SIMULADA');
  assert.equal(bien.body.reserva.estado, 'CONFIRMADA');
  const pagos = await api('GET', `/api/payments?id_reserva=${r.id_reserva}`, { token: t.token });
  assert.deepEqual(pagos.body.data.map((x) => x.estado), ['RECHAZADO', 'APROBADO']);
  const otra = await pagar(api, t.token, r.id_reserva);
  assert.equal(otra.status, 409);
  assert.equal(otra.body.error.code, 'RESERVA_NO_PAGABLE');
});

test('RF-26 validaciones: solo el turista dueño paga, con un medio válido', async () => {
  const { t, r, host } = await nueva();
  const otro = await registerUser(api);
  assert.equal((await pagar(api, otro.token, r.id_reserva)).status, 404);
  assert.equal((await pagar(api, host.token, r.id_reserva)).status, 403);
  assert.equal((await pagar(api, undefined, r.id_reserva)).status, 401);
  assert.equal((await pagar(api, t.token, r.id_reserva, 'APROBADO', 'BITCOIN')).status, 400);
  assert.equal((await pagar(api, t.token, 999999)).status, 404);
  const sinResultado = await api('POST', '/api/payments/simulate', { token: t.token, body: { id_reserva: r.id_reserva, metodo: 'TARJETA_SIMULADA' } });
  assert.ok([201].includes(sinResultado.status));
  assert.ok(['APROBADO', 'RECHAZADO'].includes(sinResultado.body.pago.estado));
  const permisos = await api('GET', `/api/payments?id_reserva=${r.id_reserva}`, { token: otro.token });
  assert.equal(permisos.status, 404);
  const admin = await createAdmin(api);
  assert.equal((await api('GET', `/api/payments?id_reserva=${r.id_reserva}`, { token: admin.token })).status, 200);
});

test('RF-28 el pago aprobado envía el resumen al turista y la alerta al anfitrión (correo y notificación)', async () => {
  const { t, r, host } = await nueva();
  outbox.length = 0;
  await pagar(api, t.token, r.id_reserva);
  const nt = await api('GET', '/api/notifications?no_leidas=true', { token: t.token });
  const pago = nt.body.data.find((n) => n.tipo === 'PAGO_APROBADO');
  assert.ok(pago, 'falta la notificación del turista');
  assert.ok(pago.mensaje.includes(r.codigo));
  const nh = await api('GET', '/api/notifications', { token: host.token });
  assert.ok(nh.body.data.some((n) => n.tipo === 'NUEVA_RESERVA' && n.mensaje.includes(r.codigo)));
  assert.equal(outbox.length, 2);
  assert.ok(outbox.some((m) => m.to === t.correo && m.subject.includes(r.codigo)));
  assert.ok(outbox.some((m) => m.to === host.correo));
  // un pago rechazado no genera avisos de confirmación
  const otra = await nueva();
  outbox.length = 0;
  await pagar(api, otra.t.token, otra.r.id_reserva, 'RECHAZADO');
  assert.equal(outbox.length, 0);
});

test('RF-28 las notificaciones se pueden listar y marcar como leídas', async () => {
  const { t, r } = await nueva();
  await pagar(api, t.token, r.id_reserva);
  const antes = await api('GET', '/api/notifications', { token: t.token });
  assert.equal(antes.body.meta.no_leidas, 1);
  const id = antes.body.data[0].id_notificacion;
  assert.equal((await api('PATCH', `/api/notifications/${id}/read`, { token: t.token })).body.leida, true);
  assert.equal((await api('GET', '/api/notifications', { token: t.token })).body.meta.no_leidas, 0);
  const otro = await registerUser(api);
  assert.equal((await api('PATCH', `/api/notifications/${id}/read`, { token: otro.token })).status, 404);
  assert.equal((await api('PATCH', '/api/notifications/read-all', { token: t.token })).status, 200);
  assert.equal((await api('GET', '/api/notifications')).status, 401);
});

test('RF-22 pagar una reserva vencida la cancela y libera el cupo', async () => {
  const { t, r, servicio } = await nueva();
  await pool.query("UPDATE reserva SET expira_en = now() - interval '1 minute' WHERE id_reserva = $1", [r.id_reserva]);
  const p = await pagar(api, t.token, r.id_reserva);
  assert.equal(p.status, 409);
  assert.equal(p.body.error.code, 'RESERVA_EXPIRADA');
  assert.equal((await api('GET', `/api/bookings/${r.id_reserva}`, { token: t.token })).body.estado, 'CANCELADA');
  assert.deepEqual(await cupos(api, servicio.id_servicio, d(2), d(3)), [1, 1]);
});
