import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupDb, startServer, registerUser, createAdmin, pool } from './helpers.js';
import { d, escenario, pagar, reservar } from './fixtures.js';

let srv;
let api;
before(async () => { await setupDb(); srv = await startServer(); api = srv.api; });
after(async () => { await srv.close(); await pool.end(); });

test('RF-37 el reporte resume reservas por estado, ingresos aprobados y servicios destacados', async () => {
  const admin = await createAdmin(api);
  const { servicio } = await escenario(api, { cupos: 5, precio: 100000 });
  const [t1, t2, t3, t4] = await Promise.all([1, 2, 3, 4].map(() => registerUser(api)));
  const id = servicio.id_servicio;
  const pagada = (await reservar(api, t1.token, id, d(2), d(4))).body; // 200.000
  await pagar(api, t1.token, pagada.id_reserva, 'APROBADO');
  await reservar(api, t2.token, id, d(2), d(3)); // pendiente
  const cancelada = (await reservar(api, t3.token, id, d(5), d(6))).body;
  await api('PATCH', `/api/bookings/${cancelada.id_reserva}/cancel`, { token: t3.token });
  const rechazada = (await reservar(api, t4.token, id, d(7), d(8))).body; // sigue pendiente
  await pagar(api, t4.token, rechazada.id_reserva, 'RECHAZADO');

  const r = await api('GET', '/api/admin/reports/summary', { token: admin.token });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.reservas_por_estado, { PENDIENTE_PAGO: 2, CONFIRMADA: 1, COMPLETADA: 0, CANCELADA: 1 });
  assert.equal(r.body.total_reservas, 4);
  assert.deepEqual(r.body.ingresos, { total: 200000, pagos_aprobados: 1 }); // el pago rechazado no suma
  assert.equal(r.body.top_servicios[0].id_servicio, id);
  assert.equal(r.body.top_servicios[0].ingresos, 200000);
  assert.deepEqual(r.body.usuarios_por_rol, { TURISTA: 4, ANFITRION: 1, NEGOCIO_LOCAL: 0, ADMINISTRADOR: 1 });
  assert.equal(r.body.denuncias_pendientes, 0);
  assert.equal(r.body.rango.hasta, d(0));

  const vacio = await api('GET', `/api/admin/reports/summary?desde=${d(-200)}&hasta=${d(-100)}`, { token: admin.token });
  assert.equal(vacio.body.total_reservas, 0);
  assert.equal(vacio.body.ingresos.total, 0);
  assert.deepEqual(vacio.body.top_servicios, []);
  const hoy = await api('GET', `/api/admin/reports/summary?desde=${d(0)}&hasta=${d(0)}`, { token: admin.token });
  assert.equal(hoy.body.total_reservas, 4);
});

test('RF-37 solo el administrador consulta reportes y el rango se valida', async () => {
  const admin = await createAdmin(api);
  const t = await registerUser(api);
  assert.equal((await api('GET', '/api/admin/reports/summary', { token: t.token })).status, 403);
  assert.equal((await api('GET', '/api/admin/reports/summary')).status, 401);
  assert.equal((await api('GET', `/api/admin/reports/summary?desde=${d(5)}&hasta=${d(1)}`, { token: admin.token })).status, 400);
  assert.equal((await api('GET', '/api/admin/reports/summary?desde=2026-13-45', { token: admin.token })).status, 400);
});
