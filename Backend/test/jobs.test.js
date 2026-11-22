import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupDb, startServer, registerUser, pool } from './helpers.js';
import { completarReservas, expirarReservasPendientes } from '../src/jobs/reservations.js';
import { cupos, d, escenario, pagar, reservar } from './fixtures.js';

let srv;
let api;
before(async () => { await setupDb(); srv = await startServer(); api = srv.api; });
after(async () => { await srv.close(); await pool.end(); });

test('RF-22 las reservas pendientes vencidas se cancelan y liberan su cupo; las vigentes no se tocan', async () => {
  const { servicio } = await escenario(api, { cupos: 2 });
  const t1 = await registerUser(api);
  const t2 = await registerUser(api);
  const vencida = (await reservar(api, t1.token, servicio.id_servicio, d(2), d(4))).body;
  const vigente = (await reservar(api, t2.token, servicio.id_servicio, d(2), d(4))).body;
  assert.deepEqual(await cupos(api, servicio.id_servicio, d(2), d(3)), [0, 0]);
  await pool.query("UPDATE reserva SET expira_en = now() - interval '5 minutes' WHERE id_reserva = $1", [vencida.id_reserva]);
  assert.equal(await expirarReservasPendientes(), 1);
  assert.equal((await api('GET', `/api/bookings/${vencida.id_reserva}`, { token: t1.token })).body.estado, 'CANCELADA');
  assert.equal((await api('GET', `/api/bookings/${vigente.id_reserva}`, { token: t2.token })).body.estado, 'PENDIENTE_PAGO');
  assert.deepEqual(await cupos(api, servicio.id_servicio, d(2), d(3)), [1, 1]);
  const avisos = await api('GET', '/api/notifications', { token: t1.token });
  assert.ok(avisos.body.data.some((n) => n.tipo === 'RESERVA_EXPIRADA'));
  assert.equal(await expirarReservasPendientes(), 0); // idempotente
});

test('RF-22 dos ejecuciones simultáneas de la tarea no liberan el cupo dos veces', async () => {
  const { servicio } = await escenario(api, { cupos: 3 });
  const turistas = await Promise.all(Array.from({ length: 3 }, () => registerUser(api)));
  const ids = [];
  for (const t of turistas) ids.push((await reservar(api, t.token, servicio.id_servicio, d(2), d(3))).body.id_reserva);
  await pool.query("UPDATE reserva SET expira_en = now() - interval '1 minute' WHERE id_reserva = ANY($1)", [ids]);
  const [a, b] = await Promise.all([expirarReservasPendientes(), expirarReservasPendientes()]);
  assert.equal(a + b, 3);
  assert.deepEqual(await cupos(api, servicio.id_servicio, d(2), d(2)), [3]); // nunca más que cupos_totales
});

test('RF-21 las reservas confirmadas pasan a COMPLETADA cuando termina la fecha de la estadía', async () => {
  const { servicio } = await escenario(api, { cupos: 2 });
  const t = await registerUser(api);
  const pasada = (await reservar(api, t.token, servicio.id_servicio, d(2), d(3))).body;
  const futura = (await reservar(api, t.token, servicio.id_servicio, d(6), d(8))).body;
  const pendiente = (await reservar(api, t.token, servicio.id_servicio, d(9), d(10))).body;
  await pagar(api, t.token, pasada.id_reserva);
  await pagar(api, t.token, futura.id_reserva);
  for (const id of [pasada.id_reserva, pendiente.id_reserva]) {
    await pool.query('UPDATE reserva SET fecha_inicio = $2, fecha_fin = $3 WHERE id_reserva = $1', [id, d(-3), d(-1)]);
  }
  assert.equal(await completarReservas(), 1);
  const estado = async (id) => (await api('GET', `/api/bookings/${id}`, { token: t.token })).body.estado;
  assert.equal(await estado(pasada.id_reserva), 'COMPLETADA');
  assert.equal(await estado(futura.id_reserva), 'CONFIRMADA');
  assert.equal(await estado(pendiente.id_reserva), 'PENDIENTE_PAGO'); // sin pago no se completa
});
