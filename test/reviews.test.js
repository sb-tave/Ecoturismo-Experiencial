import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupDb, startServer, registerUser, pool } from './helpers.js';
import { d, escenario, pagar, reservar } from './fixtures.js';

let srv;
let api;
before(async () => { await setupDb(); srv = await startServer(); api = srv.api; });
after(async () => { await srv.close(); await pool.end(); });

const completar = (idReserva) =>
  pool.query("UPDATE reserva SET estado = 'COMPLETADA', fecha_inicio = $2, fecha_fin = $3 WHERE id_reserva = $1", [idReserva, d(-3), d(-1)]);

// Reserva ya pagada y completada de un turista nuevo sobre el servicio indicado.
async function estadiaCompletada(servicio, dia = 2) {
  const t = await registerUser(api);
  const r = (await reservar(api, t.token, servicio.id_servicio, d(dia), d(dia + 1))).body;
  await pagar(api, t.token, r.id_reserva);
  await completar(r.id_reserva);
  return { t, r };
}
const resenar = (token, idServicio, body) => api('POST', `/api/services/${idServicio}/reviews`, { token, body });

test('RF-29 solo se califica una reserva completada y pagada, y una sola vez', async () => {
  const { host, servicio } = await escenario(api, { cupos: 3 });
  const t = await registerUser(api);
  const r = (await reservar(api, t.token, servicio.id_servicio, d(2), d(3))).body;
  const id = servicio.id_servicio;
  const body = { id_reserva: r.id_reserva, puntuacion: 5, comentario: 'Excelente lugar' };

  assert.equal((await resenar(t.token, id, body)).body.error.code, 'RESERVA_NO_CALIFICABLE'); // pendiente de pago
  await pagar(api, t.token, r.id_reserva);
  assert.equal((await resenar(t.token, id, body)).body.error.code, 'RESERVA_NO_CALIFICABLE'); // confirmada, aún no completada
  await completar(r.id_reserva);

  const otro = await registerUser(api);
  assert.equal((await resenar(otro.token, id, body)).status, 404); // la reserva no es suya
  assert.equal((await resenar(host.token, id, body)).status, 403);
  assert.equal((await resenar(undefined, id, body)).status, 401);
  assert.equal((await resenar(t.token, id, { ...body, puntuacion: 0 })).status, 400);
  assert.equal((await resenar(t.token, id, { ...body, puntuacion: 6 })).status, 400);
  const otroServicio = await escenario(api);
  assert.equal((await resenar(t.token, otroServicio.servicio.id_servicio, body)).body.error.code, 'RESERVA_NO_COINCIDE');

  const ok = await resenar(t.token, id, body);
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  const repetida = await resenar(t.token, id, body);
  assert.equal(repetida.status, 409);
  assert.equal(repetida.body.error.code, 'YA_CALIFICADA');
  const avisos = await api('GET', '/api/notifications', { token: host.token });
  assert.ok(avisos.body.data.some((n) => n.tipo === 'NUEVA_CALIFICACION'));
});

test('RF-29 una reserva completada sin pago aprobado no se puede calificar', async () => {
  const { servicio } = await escenario(api, { cupos: 2 });
  const t = await registerUser(api);
  const r = (await reservar(api, t.token, servicio.id_servicio, d(2), d(3))).body;
  await completar(r.id_reserva); // completada "a la fuerza", sin pagos
  const x = await resenar(t.token, servicio.id_servicio, { id_reserva: r.id_reserva, puntuacion: 4 });
  assert.equal(x.body.error.code, 'RESERVA_NO_CALIFICABLE');
});

test('RF-30 el promedio y el total se actualizan y las reseñas se listan con el autor abreviado', async () => {
  const { servicio } = await escenario(api, { cupos: 5 });
  const id = servicio.id_servicio;
  assert.equal((await api('GET', `/api/services/${id}`)).body.promedio_calificacion, null);
  const a = await estadiaCompletada(servicio, 2);
  const b = await estadiaCompletada(servicio, 4);
  await resenar(a.t.token, id, { id_reserva: a.r.id_reserva, puntuacion: 5, comentario: 'Todo perfecto' });
  await resenar(b.t.token, id, { id_reserva: b.r.id_reserva, puntuacion: 4 });

  const detalle = await api('GET', `/api/services/${id}`);
  assert.equal(detalle.body.promedio_calificacion, 4.5);
  assert.equal(detalle.body.total_calificaciones, 2);
  const card = (await api('GET', `/api/services?q=${encodeURIComponent(servicio.titulo)}`)).body.data[0];
  assert.equal(card.promedio_calificacion, 4.5);
  assert.equal(card.total_calificaciones, 2);
  assert.equal((await api('GET', '/api/services?calificacion_min=4.5')).body.data.some((x) => x.id_servicio === id), true);

  const lista = await api('GET', `/api/services/${id}/reviews`);
  assert.equal(lista.status, 200);
  assert.equal(lista.body.data.length, 2);
  assert.equal(lista.body.data[0].autor, 'Usuario T.'); // nombre + inicial: nunca el correo ni el nombre completo
  assert.deepEqual(lista.body.resumen, { promedio: 4.5, total: 2, distribucion: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 } });
  assert.equal(lista.body.data[0].correo, undefined);
  assert.equal((await api('GET', `/api/services/${id}/reviews?limit=1&page=2`)).body.data.length, 1);
  assert.equal((await api('GET', '/api/services/999999/reviews')).status, 404);
});
