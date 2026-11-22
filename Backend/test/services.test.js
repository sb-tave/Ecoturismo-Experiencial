import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupDb, startServer, registerUser, createAdmin, createCategory, pool } from './helpers.js';
import { addDays, todayISO } from '../src/utils/dates.js';

let srv;
let api;
let host;
let otro;
let cat;
before(async () => {
  await setupDb();
  srv = await startServer();
  api = srv.api;
  host = await registerUser(api, 'ANFITRION');
  otro = await registerUser(api, 'ANFITRION');
  cat = await createCategory('Hotel rural');
});
after(async () => { await srv.close(); await pool.end(); });

export const alojamiento = (id_categoria, over = {}) => ({
  tipo: 'ALOJAMIENTO', id_categoria, titulo: 'Cabaña junto al río', descripcion: 'Hospedaje rural con senderos y desayuno incluido.',
  precio_base: 180000, capacidad_max: 4, localidad: 'Salento', direccion: 'Vereda de ejemplo', latitud: 4.6372, longitud: -75.57, ...over,
});
const publicar = async (token, body) => {
  const r = await api('POST', '/api/services', { token, body });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
};

test('RF-11 categorías: el público ve las activas y solo el administrador las gestiona', async () => {
  const admin = await createAdmin(api);
  const turista = await registerUser(api);
  assert.equal((await api('POST', '/api/categories', { token: turista.token, body: { nombre: 'Senderismo' } })).status, 403);
  assert.equal((await api('POST', '/api/categories', { body: { nombre: 'Senderismo' } })).status, 401);
  const nueva = await api('POST', '/api/categories', { token: admin.token, body: { nombre: 'Senderismo', descripcion: 'Rutas guiadas' } });
  assert.equal(nueva.status, 201);
  assert.equal((await api('POST', '/api/categories', { token: admin.token, body: { nombre: 'senderismo' } })).status, 409);
  const off = await api('PATCH', `/api/categories/${nueva.body.id_categoria}`, { token: admin.token, body: { activa: false } });
  assert.equal(off.body.activa, false);
  const publico = await api('GET', '/api/categories');
  assert.ok(publico.body.data.some((c) => c.nombre === 'Hotel rural'));
  assert.ok(!publico.body.data.some((c) => c.nombre === 'Senderismo'));
  const todas = await api('GET', '/api/categories?todas=true', { token: admin.token });
  assert.ok(todas.body.data.some((c) => c.nombre === 'Senderismo'));
  const del = await api('DELETE', `/api/categories/${nueva.body.id_categoria}`, { token: admin.token });
  assert.equal(del.body.eliminada, true);
});

test('RF-11 una categoría con servicios no se elimina, solo se desactiva', async () => {
  const admin = await createAdmin(api);
  const c = await createCategory('Con servicios');
  await publicar(host.token, alojamiento(c));
  const del = await api('DELETE', `/api/categories/${c}`, { token: admin.token });
  assert.equal(del.status, 200);
  assert.equal(del.body.desactivada, true);
  const r = await api('POST', '/api/services', { token: host.token, body: alojamiento(c) });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'CATEGORIA_INACTIVA');
});

test('RF-06 el anfitrión publica un alojamiento y aparece en el catálogo al guardarlo', async () => {
  const s = await publicar(host.token, alojamiento(cat, { titulo: 'Finca cafetera con senderos' }));
  assert.equal(s.estado, 'ACTIVO');
  assert.equal(s.anfitrion.id_usuario, host.usuario.id_usuario);
  const lista = await api('GET', '/api/services?q=cafetera');
  assert.equal(lista.status, 200);
  assert.ok(lista.body.data.some((x) => x.id_servicio === s.id_servicio));
  const detalle = await api('GET', `/api/services/${s.id_servicio}`);
  assert.equal(detalle.body.titulo, 'Finca cafetera con senderos');
  assert.deepEqual(detalle.body.fotos, []);
});

test('RF-06 valida los campos obligatorios según el tipo de servicio', async () => {
  const sin = alojamiento(cat); delete sin.precio_base;
  assert.equal((await api('POST', '/api/services', { token: host.token, body: sin })).status, 400);
  const soloLat = await api('POST', '/api/services', { token: host.token, body: alojamiento(cat, { longitud: undefined }) });
  assert.equal(soloLat.status, 400);
  const negocio = await registerUser(api, 'NEGOCIO_LOCAL');
  const base = { tipo: 'NEGOCIO_LOCAL', id_categoria: cat, titulo: 'Artesanías del pueblo', descripcion: 'Productos artesanales hechos a mano.', localidad: 'Salento' };
  assert.equal((await api('POST', '/api/services', { token: negocio.token, body: base })).status, 400); // falta contacto
  assert.equal((await api('POST', '/api/services', { token: negocio.token, body: { ...base, contacto: '3001112233', precio_base: 10 } })).status, 400);
  const ok = await api('POST', '/api/services', { token: negocio.token, body: { ...base, contacto: '3001112233' } });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.contacto, '3001112233');
});

test('RF-04 roles: el turista no publica y cada rol publica solo su tipo de servicio', async () => {
  const turista = await registerUser(api, 'TURISTA');
  assert.equal((await api('POST', '/api/services', { token: turista.token, body: alojamiento(cat) })).status, 403);
  assert.equal((await api('POST', '/api/services', { body: alojamiento(cat) })).status, 401);
  const negocio = await registerUser(api, 'NEGOCIO_LOCAL');
  const r = await api('POST', '/api/services', { token: negocio.token, body: alojamiento(cat) });
  assert.equal(r.status, 403);
  assert.equal(r.body.error.code, 'TIPO_NO_PERMITIDO');
  const n = await api('POST', '/api/services', { token: host.token, body: { tipo: 'NEGOCIO_LOCAL', id_categoria: cat, titulo: 'Tienda local', descripcion: 'Tienda de productos locales.', localidad: 'Salento', contacto: 'x@y.co' } });
  assert.equal(n.status, 403);
});

test('RF-07 solo el propietario edita su publicación y el tipo no se puede cambiar', async () => {
  const s = await publicar(host.token, alojamiento(cat));
  const ajeno = await api('PATCH', `/api/services/${s.id_servicio}`, { token: otro.token, body: { titulo: 'Intento ajeno' } });
  assert.equal(ajeno.status, 403);
  assert.equal(ajeno.body.error.code, 'NO_ES_PROPIETARIO');
  assert.equal((await api('PATCH', `/api/services/${s.id_servicio}`, { token: host.token, body: { tipo: 'ACTIVIDAD' } })).status, 400);
  const ok = await api('PATCH', `/api/services/${s.id_servicio}`, { token: host.token, body: { titulo: 'Título nuevo', precio_base: 200000 } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.titulo, 'Título nuevo');
  assert.equal(ok.body.precio_base, 200000);
  assert.equal((await api('DELETE', `/api/services/${s.id_servicio}`, { token: otro.token })).status, 403);
  assert.equal((await api('PATCH', '/api/services/999999', { token: host.token, body: { titulo: 'No existe' } })).status, 404);
});

test('RF-08 una publicación inactiva sale del catálogo, solo la ve su propietario y se puede reactivar', async () => {
  const s = await publicar(host.token, alojamiento(cat, { titulo: 'Cabaña temporal' }));
  const off = await api('PATCH', `/api/services/${s.id_servicio}`, { token: host.token, body: { estado: 'INACTIVO' } });
  assert.equal(off.body.estado, 'INACTIVO');
  assert.ok(!(await api('GET', '/api/services?q=temporal')).body.data.some((x) => x.id_servicio === s.id_servicio));
  assert.equal((await api('GET', `/api/services/${s.id_servicio}`)).status, 404);
  assert.equal((await api('GET', `/api/services/${s.id_servicio}`, { token: host.token })).status, 200);
  assert.equal((await api('GET', `/api/services/${s.id_servicio}`, { token: otro.token })).status, 404);
  const mias = await api('GET', '/api/services/mine?estado=INACTIVO', { token: host.token });
  assert.ok(mias.body.data.some((x) => x.id_servicio === s.id_servicio));
  await api('PATCH', `/api/services/${s.id_servicio}`, { token: host.token, body: { estado: 'ACTIVO' } });
  assert.equal((await api('GET', `/api/services/${s.id_servicio}`)).status, 200);
});

test('RF-08 eliminar una publicación sin reservas la borra definitivamente', async () => {
  const s = await publicar(host.token, alojamiento(cat));
  const del = await api('DELETE', `/api/services/${s.id_servicio}`, { token: host.token });
  assert.equal(del.status, 200);
  assert.equal(del.body.eliminado, true);
  assert.equal((await api('GET', `/api/services/${s.id_servicio}`, { token: host.token })).status, 404);
});

test('RF-12/13 búsqueda por texto, tipo, categoría, localidad, precio, capacidad y calificación', async () => {
  const c2 = await createCategory('Aventura');
  const h = await registerUser(api, 'ANFITRION');
  const a = await publicar(h.token, alojamiento(cat, { titulo: 'Posada Los Nogales', localidad: 'Jardín', precio_base: 100000, capacidad_max: 2 }));
  const b = await publicar(h.token, alojamiento(c2, { titulo: 'Glamping bajo las estrellas', localidad: 'Guatapé', precio_base: 400000, capacidad_max: 6 }));
  const act = await publicar(h.token, { tipo: 'ACTIVIDAD', id_categoria: c2, titulo: 'Caminata al amanecer', descripcion: 'Ruta guiada por el bosque de niebla.', precio_base: 50000, capacidad_max: 10, localidad: 'Jardín' });
  await pool.query('UPDATE servicio SET promedio_calificacion = 4.5 WHERE id_servicio = $1', [b.id_servicio]);
  const ids = async (qs) => (await api('GET', `/api/services?${qs}`)).body.data.map((x) => x.id_servicio);
  assert.deepEqual((await ids('q=nogales')), [a.id_servicio]);
  assert.deepEqual(new Set(await ids('localidad=jard')), new Set([a.id_servicio, act.id_servicio]));
  assert.deepEqual(await ids(`tipo=ACTIVIDAD&id_categoria=${c2}`), [act.id_servicio]);
  assert.deepEqual(new Set(await ids(`id_categoria=${c2}`)), new Set([b.id_servicio, act.id_servicio]));
  assert.deepEqual(await ids('precio_min=300000'), [b.id_servicio]);
  assert.deepEqual(new Set(await ids('precio_max=100000')), new Set([a.id_servicio, act.id_servicio]));
  assert.deepEqual(await ids('calificacion_min=4'), [b.id_servicio]);
  assert.deepEqual(await ids('q=glamping&personas=7'), []);
  assert.deepEqual(await ids('q=%25'), []); // el comodín % se escapa y no devuelve todo
  const mal = await api('GET', '/api/services?precio_min=10&precio_max=5');
  assert.equal(mal.status, 400);
  const card = (await api('GET', '/api/services?q=glamping')).body.data[0];
  assert.equal(card.categoria, 'Aventura');
  assert.equal(card.total_calificaciones, 0);
  assert.equal(card.anfitrion.id_usuario, h.usuario.id_usuario);
});

test('RF-13 paginación y ordenamiento de resultados', async () => {
  const h = await registerUser(api, 'ANFITRION');
  const c = await createCategory('Orden');
  for (const [i, p] of [[1, 300000], [2, 100000], [3, 200000]]) await publicar(h.token, alojamiento(c, { titulo: `Orden ${i}`, precio_base: p }));
  const asc = await api('GET', `/api/services?id_categoria=${c}&orden=precio_asc`);
  assert.deepEqual(asc.body.data.map((x) => x.precio_base), [100000, 200000, 300000]);
  const desc = await api('GET', `/api/services?id_categoria=${c}&orden=precio_desc&limit=2&page=2`);
  assert.deepEqual(desc.body.data.map((x) => x.precio_base), [100000]);
  assert.deepEqual(desc.body.meta, { page: 2, limit: 2, total: 3, total_pages: 2 });
  assert.equal((await api('GET', '/api/services?limit=500')).status, 400);
});

test('RF-15 búsqueda por cercanía: respeta el radio y ordena por distancia', async () => {
  const h = await registerUser(api, 'ANFITRION');
  const c = await createCategory('Cercanía');
  const salento = await publicar(h.token, alojamiento(c, { titulo: 'Geo Salento', latitud: 4.6372, longitud: -75.57 }));
  const filandia = await publicar(h.token, alojamiento(c, { titulo: 'Geo Filandia', latitud: 4.6733, longitud: -75.658 }));
  const bogota = await publicar(h.token, alojamiento(c, { titulo: 'Geo Bogotá', latitud: 4.711, longitud: -74.0721 }));
  const r = await api('GET', `/api/services?id_categoria=${c}&lat=4.6372&lng=-75.57&radio_km=20`);
  assert.deepEqual(r.body.data.map((x) => x.id_servicio), [salento.id_servicio, filandia.id_servicio]);
  assert.ok(r.body.data[0].distancia_km < 0.1);
  assert.ok(r.body.data[1].distancia_km > 8 && r.body.data[1].distancia_km < 13);
  const todos = await api('GET', `/api/services?id_categoria=${c}&lat=4.6372&lng=-75.57&radio_km=200`);
  assert.equal(todos.body.data.length, 3);
  assert.equal(todos.body.data[2].id_servicio, bogota.id_servicio);
  assert.equal((await api('GET', '/api/services?lat=4.6')).status, 400);
});

test('RF-13 filtro por fechas disponibles (alojamiento por noches, actividad por personas)', async () => {
  const h = await registerUser(api, 'ANFITRION');
  const c = await createCategory('Fechas');
  const d = (n) => addDays(todayISO(), n);
  const a = await publicar(h.token, alojamiento(c, { titulo: 'Disponible larga' }));
  const b = await publicar(h.token, alojamiento(c, { titulo: 'Disponible corta' }));
  const act = await publicar(h.token, { tipo: 'ACTIVIDAD', id_categoria: c, titulo: 'Actividad cupos', descripcion: 'Actividad con cupos por persona.', precio_base: 30000, capacidad_max: 10, localidad: 'Salento' });
  assert.equal((await api('PUT', `/api/services/${a.id_servicio}/availability`, { token: h.token, body: { desde: d(1), hasta: d(6), cupos_totales: 1 } })).status, 200);
  assert.equal((await api('PUT', `/api/services/${b.id_servicio}/availability`, { token: h.token, body: { desde: d(1), hasta: d(2), cupos_totales: 1 } })).status, 200);
  assert.equal((await api('PUT', `/api/services/${act.id_servicio}/availability`, { token: h.token, body: { desde: d(2), hasta: d(2), cupos_totales: 5 } })).status, 200);
  const ids = async (qs) => new Set((await api('GET', `/api/services?id_categoria=${c}&${qs}`)).body.data.map((x) => x.id_servicio));
  assert.deepEqual(await ids(`fecha_inicio=${d(1)}&fecha_fin=${d(4)}`), new Set([a.id_servicio])); // 3 noches
  assert.deepEqual(await ids(`fecha_inicio=${d(1)}&fecha_fin=${d(3)}`), new Set([a.id_servicio, b.id_servicio])); // 2 noches
  assert.deepEqual(await ids(`fecha_inicio=${d(2)}&fecha_fin=${d(2)}&personas=3`), new Set([act.id_servicio])); // alojamiento no admite 0 noches
  assert.deepEqual(await ids(`fecha_inicio=${d(2)}&fecha_fin=${d(2)}&personas=6`), new Set());
  assert.equal((await api('GET', `/api/services?fecha_inicio=${d(1)}`)).status, 400);
  assert.equal((await api('GET', '/api/services?fecha_inicio=2026-02-30&fecha_fin=2026-03-02')).status, 400); // fecha inexistente
});

test('RF-17/RF-18 disponibilidad: define cupos por día, consulta el calendario y bloquea fechas', async () => {
  const h = await registerUser(api, 'ANFITRION');
  const s = await publicar(h.token, alojamiento(cat));
  const d = (n) => addDays(todayISO(), n);
  const base = `/api/services/${s.id_servicio}/availability`;
  assert.equal((await api('PUT', base, { token: otro.token, body: { desde: d(1), hasta: d(3), cupos_totales: 2 } })).status, 403);
  assert.equal((await api('PUT', base, { token: h.token, body: { desde: d(-2), hasta: d(3), cupos_totales: 2 } })).status, 400);
  assert.equal((await api('PUT', base, { token: h.token, body: { desde: d(3), hasta: d(1), cupos_totales: 2 } })).status, 400);
  const ok = await api('PUT', base, { token: h.token, body: { desde: d(1), hasta: d(5), cupos_totales: 2 } });
  assert.equal(ok.body.dias_actualizados, 5);
  const cal = await api('GET', `${base}?desde=${d(1)}&hasta=${d(7)}`);
  assert.equal(cal.body.dias.length, 5);
  assert.deepEqual(cal.body.dias[0], { fecha: d(1), cupos_totales: 2, cupos_disponibles: 2, disponible: true });
  const bloq = await api('POST', `${base}/block`, { token: h.token, body: { desde: d(2), hasta: d(3) } });
  assert.deepEqual(bloq.body.bloqueadas, [d(2), d(3)]);
  const cal2 = await api('GET', `${base}?desde=${d(1)}&hasta=${d(5)}`);
  assert.equal(cal2.body.dias.find((x) => x.fecha === d(2)).disponible, false);
  assert.equal(cal2.body.dias.find((x) => x.fecha === d(4)).disponible, true);
  // un negocio local no maneja disponibilidad
  const negocio = await registerUser(api, 'NEGOCIO_LOCAL');
  const n = await publicar(negocio.token, { tipo: 'NEGOCIO_LOCAL', id_categoria: cat, titulo: 'Panadería local', descripcion: 'Pan artesanal del pueblo.', localidad: 'Salento', contacto: '3000000000' });
  assert.equal((await api('GET', `/api/services/${n.id_servicio}/availability`)).body.reservable, false);
});

test('RF-17 no se pueden reducir los cupos por debajo de lo ya reservado', async () => {
  const h = await registerUser(api, 'ANFITRION');
  const s = await publicar(h.token, alojamiento(cat));
  const d = (n) => addDays(todayISO(), n);
  const base = `/api/services/${s.id_servicio}/availability`;
  await api('PUT', base, { token: h.token, body: { desde: d(1), hasta: d(3), cupos_totales: 3 } });
  await pool.query('UPDATE disponibilidad SET cupos_disponibles = 1 WHERE id_servicio = $1 AND fecha = $2', [s.id_servicio, d(2)]); // 2 reservados ese día
  const r = await api('PUT', base, { token: h.token, body: { desde: d(1), hasta: d(3), cupos_totales: 1 } });
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'CUPOS_INFERIORES_A_RESERVADOS');
  assert.deepEqual(r.body.error.details.fechas, [d(2)]);
  const subir = await api('PUT', base, { token: h.token, body: { desde: d(1), hasta: d(3), cupos_totales: 5 } });
  assert.equal(subir.status, 200);
  const cal = await api('GET', `${base}?desde=${d(2)}&hasta=${d(2)}`);
  assert.equal(cal.body.dias[0].cupos_disponibles, 3); // 5 totales - 2 reservados
  const bloq = await api('POST', `${base}/block`, { token: h.token, body: { desde: d(1), hasta: d(3) } });
  assert.deepEqual(bloq.body.con_reservas, [d(2)]);
  assert.deepEqual(bloq.body.bloqueadas, [d(1), d(3)]);
});
