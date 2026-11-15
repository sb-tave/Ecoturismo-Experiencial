import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupDb, startServer, registerUser, createAdmin, pool } from './helpers.js';
import { cupos, d, escenario, pagar, reservar } from './fixtures.js';

let srv;
let api;
before(async () => { await setupDb(); srv = await startServer(); api = srv.api; });
after(async () => { await srv.close(); await pool.end(); });

test('RF-19 reserva un alojamiento: precio calculado en el backend, pendiente de pago, con comprobante y cupos por noche', async () => {
  const { servicio } = await escenario(api, { precio: 150000, cupos: 2 });
  const t = await registerUser(api);
  const r = await reservar(api, t.token, servicio.id_servicio, d(2), d(4)); // 2 noches: 2 y 3
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.estado, 'PENDIENTE_PAGO');
  assert.equal(r.body.precio_total, 300000);
  assert.match(r.body.codigo, /^ECO-\d{6}$/);
  assert.equal(r.body.comprobante.total, 300000);
  assert.equal(r.body.comprobante.estado, 'PENDIENTE_PAGO');
  const vence = new Date(r.body.expira_en).getTime() - Date.now();
  assert.ok(vence > 14 * 60_000 && vence <= 15 * 60_000, `vence en ${vence} ms`);
  // consume las noches 2 y 3; el día de salida (4) queda libre
  assert.deepEqual(await cupos(api, servicio.id_servicio, d(1), d(5)), [2, 1, 1, 2, 2]);
});

test('RF-19 reserva una actividad: precio por persona y cupos por persona', async () => {
  const { servicio } = await escenario(api, { tipo: 'ACTIVIDAD', precio: 40000, cupos: 10, capacidad: 8 });
  const t = await registerUser(api);
  const r = await reservar(api, t.token, servicio.id_servicio, d(3), d(3), 3);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.precio_total, 120000);
  assert.deepEqual(await cupos(api, servicio.id_servicio, d(2), d(4)), [10, 7, 10]);
  const mucho = await reservar(api, t.token, servicio.id_servicio, d(3), d(3), 9);
  assert.equal(mucho.body.error.code, 'CAPACIDAD_EXCEDIDA');
  const sinCupo = await reservar(api, t.token, servicio.id_servicio, d(3), d(3), 8);
  assert.equal(sinCupo.status, 409);
  assert.equal(sinCupo.body.error.code, 'SIN_DISPONIBILIDAD');
});

test('RF-19 valida fechas, roles, servicio y disponibilidad', async () => {
  const { host, servicio } = await escenario(api, { cupos: 1, dias: 10 });
  const t = await registerUser(api);
  const id = servicio.id_servicio;
  assert.equal((await reservar(api, t.token, id, d(-1), d(1))).body.error.code, 'FECHA_PASADA');
  assert.equal((await reservar(api, t.token, id, d(2), d(2))).body.error.code, 'RANGO_INVALIDO'); // alojamiento: mínimo 1 noche
  assert.equal((await reservar(api, t.token, id, d(3), d(2))).status, 400);
  assert.equal((await reservar(api, t.token, id, d(2), d(40))).body.error.code, 'ESTADIA_MUY_LARGA');
  assert.equal((await reservar(api, t.token, id, d(9), d(14))).body.error.code, 'SIN_DISPONIBILIDAD'); // más allá de lo publicado
  assert.equal((await reservar(api, t.token, 999999, d(2), d(3))).status, 404);
  assert.equal((await reservar(api, host.token, id, d(2), d(3))).status, 403); // un anfitrión no reserva
  assert.equal((await reservar(api, undefined, id, d(2), d(3))).status, 401);
  await api('PATCH', `/api/services/${id}`, { token: host.token, body: { estado: 'INACTIVO' } });
  assert.equal((await reservar(api, t.token, id, d(2), d(3))).body.error.code, 'SERVICIO_NO_DISPONIBLE');
  // un negocio local no admite reservas
  const negocio = await registerUser(api, 'NEGOCIO_LOCAL');
  const cat = (await api('GET', '/api/categories')).body.data[0].id_categoria;
  const n = await api('POST', '/api/services', { token: negocio.token, body: { tipo: 'NEGOCIO_LOCAL', id_categoria: cat, titulo: 'Tienda local', descripcion: 'Productos locales hechos a mano.', localidad: 'Salento', contacto: '3000000000' } });
  assert.equal((await reservar(api, t.token, n.body.id_servicio, d(2), d(3))).body.error.code, 'SERVICIO_NO_RESERVABLE');
});

test('RF-20 reservas simultáneas por el último cupo: solo una se acepta y nunca hay sobreventa', async () => {
  const { servicio } = await escenario(api, { cupos: 1 });
  const turistas = await Promise.all(Array.from({ length: 8 }, () => registerUser(api)));
  const resultados = await Promise.all(turistas.map((t) => reservar(api, t.token, servicio.id_servicio, d(2), d(4))));
  const ok = resultados.filter((r) => r.status === 201);
  const fallidas = resultados.filter((r) => r.status === 409);
  assert.equal(ok.length, 1, resultados.map((r) => r.status).join(','));
  assert.equal(fallidas.length, 7);
  assert.ok(fallidas.every((r) => r.body.error.code === 'SIN_DISPONIBILIDAD'));
  assert.deepEqual(await cupos(api, servicio.id_servicio, d(2), d(3)), [0, 0]);
  const { rows } = await pool.query("SELECT COUNT(*) AS n FROM reserva WHERE id_servicio = $1 AND estado = 'PENDIENTE_PAGO'", [servicio.id_servicio]);
  assert.equal(rows[0].n, 1);
});

test('RF-20 reservas simultáneas con fechas que se cruzan: ningún día supera sus cupos', async () => {
  const { servicio } = await escenario(api, { cupos: 2, dias: 12 });
  const turistas = await Promise.all(Array.from({ length: 12 }, () => registerUser(api)));
  const rangos = [[2, 5], [3, 6], [4, 7], [2, 4], [5, 8], [3, 5], [4, 6], [6, 9], [2, 3], [7, 9], [3, 4], [5, 7]];
  await Promise.all(turistas.map((t, i) => reservar(api, t.token, servicio.id_servicio, d(rangos[i][0]), d(rangos[i][1]))));
  const { rows } = await pool.query(
    `SELECT dd.fecha, dd.cupos_totales,
            (SELECT COUNT(*) FROM reserva r WHERE r.id_servicio = dd.id_servicio AND r.estado = 'PENDIENTE_PAGO'
                AND dd.fecha >= r.fecha_inicio AND dd.fecha < r.fecha_fin) AS ocupados, dd.cupos_disponibles
       FROM disponibilidad dd WHERE dd.id_servicio = $1`,
    [servicio.id_servicio],
  );
  for (const f of rows) {
    assert.ok(f.ocupados <= f.cupos_totales, `sobreventa el ${f.fecha}: ${f.ocupados}/${f.cupos_totales}`);
    assert.equal(f.cupos_disponibles, f.cupos_totales - f.ocupados, `cupos inconsistentes el ${f.fecha}`);
  }
});

test('RF-23 / RF-25 / RF-36 cada rol ve solo las reservas que le corresponden', async () => {
  const a = await escenario(api, { cupos: 3 });
  const b = await escenario(api, { cupos: 3 });
  const t1 = await registerUser(api);
  const t2 = await registerUser(api);
  const admin = await createAdmin(api);
  const r1 = (await reservar(api, t1.token, a.servicio.id_servicio, d(2), d(3))).body;
  await reservar(api, t2.token, a.servicio.id_servicio, d(4), d(5));
  await reservar(api, t2.token, b.servicio.id_servicio, d(2), d(3));
  await pagar(api, t1.token, r1.id_reserva);

  const mias = await api('GET', '/api/bookings', { token: t1.token });
  assert.equal(mias.body.data.length, 1);
  assert.equal(mias.body.data[0].estado_pago, 'APROBADO');
  assert.equal(mias.body.data[0].servicio.titulo, a.servicio.titulo);

  const recibidas = await api('GET', '/api/bookings', { token: a.host.token }); // RF-25
  assert.equal(recibidas.body.data.length, 2);
  assert.ok(recibidas.body.data.every((x) => x.id_servicio === a.servicio.id_servicio));
  assert.ok(recibidas.body.data.every((x) => x.turista.nombre && x.estado_pago));
  assert.deepEqual(new Set(recibidas.body.data.map((x) => x.estado_pago)), new Set(['APROBADO', 'PENDIENTE']));

  const todas = await api('GET', '/api/bookings?limit=2', { token: admin.token });
  const totalBd = (await pool.query('SELECT COUNT(*) AS n FROM reserva')).rows[0].n;
  assert.equal(todas.body.meta.total, totalBd); // el administrador ve todas las reservas del sistema
  assert.equal(todas.body.data.length, 2);
  const confirmadasBd = (await pool.query("SELECT COUNT(*) AS n FROM reserva WHERE estado = 'CONFIRMADA'")).rows[0].n;
  const filtradas = await api('GET', '/api/bookings?estado=CONFIRMADA', { token: admin.token });
  assert.equal(filtradas.body.meta.total, confirmadasBd);
  assert.ok(filtradas.body.data.every((x) => x.estado === 'CONFIRMADA'));
  const negocio = await registerUser(api, 'NEGOCIO_LOCAL');
  assert.equal((await api('GET', '/api/bookings', { token: negocio.token })).status, 403);

  // detalle: solo el turista, el anfitrión propietario y el administrador
  assert.equal((await api('GET', `/api/bookings/${r1.id_reserva}`, { token: t1.token })).body.pagos.length, 1);
  assert.equal((await api('GET', `/api/bookings/${r1.id_reserva}`, { token: a.host.token })).status, 200);
  assert.equal((await api('GET', `/api/bookings/${r1.id_reserva}`, { token: admin.token })).status, 200);
  assert.equal((await api('GET', `/api/bookings/${r1.id_reserva}`, { token: t2.token })).status, 404);
  assert.equal((await api('GET', `/api/bookings/${r1.id_reserva}`, { token: b.host.token })).status, 404);
});

test('RF-24 el turista cancela su reserva y se liberan los cupos; no se cancela dos veces', async () => {
  const { servicio } = await escenario(api, { cupos: 1 });
  const t = await registerUser(api);
  const otro = await registerUser(api);
  const r = (await reservar(api, t.token, servicio.id_servicio, d(2), d(4))).body;
  assert.deepEqual(await cupos(api, servicio.id_servicio, d(2), d(3)), [0, 0]);
  assert.equal((await api('PATCH', `/api/bookings/${r.id_reserva}/cancel`, { token: otro.token })).status, 404);
  const c = await api('PATCH', `/api/bookings/${r.id_reserva}/cancel`, { token: t.token });
  assert.equal(c.status, 200);
  assert.equal(c.body.reserva.estado, 'CANCELADA');
  assert.deepEqual(await cupos(api, servicio.id_servicio, d(2), d(3)), [1, 1]);
  const otra = await api('PATCH', `/api/bookings/${r.id_reserva}/cancel`, { token: t.token });
  assert.equal(otra.status, 409);
  assert.equal(otra.body.error.code, 'RESERVA_NO_CANCELABLE');
  assert.equal((await reservar(api, otro.token, servicio.id_servicio, d(2), d(4))).status, 201); // el cupo vuelve a estar disponible
});

test('RF-24 no se cancela una reserva completada', async () => {
  const { servicio } = await escenario(api, { cupos: 1 });
  const t = await registerUser(api);
  const r = (await reservar(api, t.token, servicio.id_servicio, d(2), d(3))).body;
  await pagar(api, t.token, r.id_reserva);
  await pool.query("UPDATE reserva SET estado = 'COMPLETADA' WHERE id_reserva = $1", [r.id_reserva]);
  assert.equal((await api('PATCH', `/api/bookings/${r.id_reserva}/cancel`, { token: t.token })).body.error.code, 'RESERVA_NO_CANCELABLE');
});

test('RF-36 el administrador cancela una reserva confirmada y se notifica al turista y al anfitrión', async () => {
  const { host, servicio } = await escenario(api, { cupos: 1 });
  const t = await registerUser(api);
  const admin = await createAdmin(api);
  const r = (await reservar(api, t.token, servicio.id_servicio, d(2), d(3))).body;
  await pagar(api, t.token, r.id_reserva);
  const c = await api('PATCH', `/api/bookings/${r.id_reserva}/cancel`, { token: admin.token, body: { motivo: 'Mantenimiento del alojamiento' } });
  assert.equal(c.status, 200);
  assert.deepEqual(await cupos(api, servicio.id_servicio, d(2), d(2)), [1]);
  const nt = await api('GET', '/api/notifications', { token: t.token });
  assert.ok(nt.body.data.some((n) => n.tipo === 'RESERVA_CANCELADA' && n.mensaje.includes('Mantenimiento')));
  const nh = await api('GET', '/api/notifications', { token: host.token });
  assert.ok(nh.body.data.some((n) => n.tipo === 'RESERVA_CANCELADA'));
});
