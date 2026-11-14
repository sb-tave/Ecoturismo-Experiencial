import { query, withTransaction } from '../../db/pool.js';
import { config } from '../../config/env.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import { escapeLike, pageMeta } from '../../utils/schemas.js';
import { deleteImage } from '../../services/storage.js';

export const abs = (url) => (url ? `${config.publicBaseUrl}${url}` : null);

// RF-06: un anfitrión publica alojamientos y actividades; un negocio local solo publica su negocio.
const TIPOS_POR_ROL = { ANFITRION: ['ALOJAMIENTO', 'ACTIVIDAD'], NEGOCIO_LOCAL: ['NEGOCIO_LOCAL'] };
const EDITABLES = ['id_categoria', 'titulo', 'descripcion', 'precio_base', 'capacidad_max', 'localidad', 'direccion', 'latitud', 'longitud', 'contacto', 'estado'];

// Reglas que dependen de varios campos a la vez (se usan al crear y al editar).
export function invariantErrors(s) {
  const errs = [];
  if ((s.latitud == null) !== (s.longitud == null)) errs.push({ campo: 'latitud', mensaje: 'Envía latitud y longitud juntas' });
  if (s.tipo === 'NEGOCIO_LOCAL') {
    if (!s.contacto) errs.push({ campo: 'contacto', mensaje: 'Los negocios locales deben indicar un dato de contacto' });
    if (s.precio_base != null) errs.push({ campo: 'precio_base', mensaje: 'Los negocios locales no tienen precio base' });
    if (s.capacidad_max != null) errs.push({ campo: 'capacidad_max', mensaje: 'Los negocios locales no tienen capacidad máxima' });
  } else {
    if (s.precio_base == null) errs.push({ campo: 'precio_base', mensaje: 'El precio base es obligatorio' });
    if (s.capacidad_max == null) errs.push({ campo: 'capacidad_max', mensaje: 'La capacidad máxima es obligatoria' });
  }
  return errs;
}

const CARD_COLUMNS = `
  s.id_servicio, s.tipo, s.titulo, LEFT(s.descripcion, 160) AS descripcion_corta, s.precio_base, s.capacidad_max,
  s.localidad, s.latitud, s.longitud, s.id_categoria, c.nombre AS categoria, s.estado, s.promedio_calificacion,
  (SELECT COUNT(*) FROM calificacion k WHERE k.id_servicio = s.id_servicio AND k.estado = 'VISIBLE') AS total_calificaciones,
  (SELECT f.url FROM foto_servicio f WHERE f.id_servicio = s.id_servicio ORDER BY f.es_principal DESC, f.orden, f.id_foto LIMIT 1) AS foto_principal,
  s.id_anfitrion, u.nombre AS anfitrion_nombre`;
const FROM = 'FROM servicio s JOIN usuario u ON u.id_usuario = s.id_anfitrion JOIN categoria c ON c.id_categoria = s.id_categoria';

const mapCard = (r) => ({
  id_servicio: r.id_servicio,
  tipo: r.tipo,
  titulo: r.titulo,
  descripcion_corta: r.descripcion_corta,
  precio_base: r.precio_base,
  capacidad_max: r.capacidad_max,
  localidad: r.localidad,
  latitud: r.latitud,
  longitud: r.longitud,
  id_categoria: r.id_categoria,
  categoria: r.categoria,
  estado: r.estado,
  promedio_calificacion: r.promedio_calificacion,
  total_calificaciones: r.total_calificaciones,
  foto_principal: abs(r.foto_principal),
  ...(r.distancia_km != null ? { distancia_km: r.distancia_km } : {}),
  anfitrion: { id_usuario: r.id_anfitrion, nombre: r.anfitrion_nombre },
});

const ORDENES = {
  recientes: 's.fecha_creacion DESC, s.id_servicio DESC',
  precio_asc: 's.precio_base ASC NULLS LAST, s.id_servicio',
  precio_desc: 's.precio_base DESC NULLS LAST, s.id_servicio',
  calificacion: 's.promedio_calificacion DESC NULLS LAST, total_calificaciones DESC, s.id_servicio',
  distancia: 'distancia_km ASC, s.id_servicio',
};

// RF-12, RF-13, RF-15: búsqueda pública con filtros combinables. Todo va parametrizado (OWASP A03).
export async function search(q) {
  const params = [];
  const p = (v) => { params.push(v); return `$${params.length}`; };
  const where = ["s.estado = 'ACTIVO'", "u.estado = 'ACTIVO'"];

  if (q.q) { const l = p(`%${escapeLike(q.q)}%`); where.push(`(s.titulo ILIKE ${l} OR s.descripcion ILIKE ${l} OR s.localidad ILIKE ${l})`); }
  if (q.tipo) where.push(`s.tipo = ${p(q.tipo)}`);
  if (q.id_categoria) where.push(`s.id_categoria = ${p(q.id_categoria)}`);
  if (q.localidad) where.push(`s.localidad ILIKE ${p(`%${escapeLike(q.localidad)}%`)}`);
  if (q.precio_min != null) where.push(`s.precio_base >= ${p(q.precio_min)}`);
  if (q.precio_max != null) where.push(`s.precio_base <= ${p(q.precio_max)}`);
  if (q.calificacion_min != null) where.push(`s.promedio_calificacion >= ${p(q.calificacion_min)}`);
  if (q.personas) where.push(`(s.capacidad_max IS NULL OR s.capacidad_max >= ${p(q.personas)}::int)`);

  // Disponibilidad: cada día consumido debe tener cupos suficientes.
  // Alojamiento: noches [inicio, fin) con 1 cupo. Actividad: días [inicio, fin] con un cupo por persona.
  if (q.fecha_inicio) {
    const a = p(q.fecha_inicio);
    const b = p(q.fecha_fin);
    const n = p(q.personas ?? 1);
    const ultimo = `(CASE WHEN s.tipo = 'ALOJAMIENTO' THEN ${b}::date - 1 ELSE ${b}::date END)`;
    where.push("s.tipo <> 'NEGOCIO_LOCAL'");
    where.push(`(s.tipo <> 'ALOJAMIENTO' OR ${b}::date > ${a}::date)`);
    where.push(`(SELECT COUNT(*) FROM disponibilidad d WHERE d.id_servicio = s.id_servicio
                   AND d.fecha BETWEEN ${a}::date AND ${ultimo}
                   AND d.cupos_disponibles >= (CASE WHEN s.tipo = 'ACTIVIDAD' THEN ${n}::int ELSE 1 END)) = (${ultimo} - ${a}::date + 1)`);
  }

  // Cercanía: caja de coordenadas (usa el índice) + fórmula de Haversine, sin extensiones de PostgreSQL.
  const geo = q.lat != null && q.lng != null;
  let distancia = null;
  if (geo) {
    const lat = `${p(q.lat)}::float8`;
    const lng = `${p(q.lng)}::float8`;
    const r = `${p(q.radio_km)}::float8`;
    distancia = `(6371 * 2 * asin(LEAST(1.0, sqrt(power(sin(radians(s.latitud - ${lat}) / 2), 2) + cos(radians(${lat})) * cos(radians(s.latitud)) * power(sin(radians(s.longitud - ${lng}) / 2), 2)))))`;
    where.push('s.latitud IS NOT NULL');
    where.push(`s.latitud BETWEEN ${lat} - (${r} / 111.0) AND ${lat} + (${r} / 111.0)`);
    where.push(`s.longitud BETWEEN ${lng} - (${r} / (111.0 * GREATEST(cos(radians(${lat})), 0.01))) AND ${lng} + (${r} / (111.0 * GREATEST(cos(radians(${lat})), 0.01)))`);
    where.push(`${distancia} <= ${r}`);
  }

  const orden = q.orden === 'distancia' && !geo ? 'recientes' : q.orden || (geo ? 'distancia' : 'recientes');
  const base = `${FROM} WHERE ${where.join(' AND ')}`;
  const { rows: [{ n: total }] } = await query(`SELECT COUNT(*) AS n ${base}`, params);
  const offset = (q.page - 1) * q.limit;
  const { rows } = await query(
    `SELECT ${CARD_COLUMNS}${geo ? `, ROUND((${distancia})::numeric, 2) AS distancia_km` : ''}
       ${base} ORDER BY ${ORDENES[orden]} LIMIT ${p(q.limit)} OFFSET ${p(offset)}`,
    params,
  );
  return { data: rows.map(mapCard), meta: pageMeta(q.page, q.limit, total) };
}

export async function listMine(user, { estado, page, limit }) {
  const params = [user.id_usuario];
  let filtro = '';
  if (estado) { params.push(estado); filtro = `AND s.estado = $${params.length}`; }
  const base = `${FROM} WHERE s.id_anfitrion = $1 ${filtro}`;
  const { rows: [{ n }] } = await query(`SELECT COUNT(*) AS n ${base}`, params);
  params.push(limit, (page - 1) * limit);
  const { rows } = await query(`SELECT ${CARD_COLUMNS} ${base} ORDER BY s.fecha_creacion DESC, s.id_servicio DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  return { data: rows.map(mapCard), meta: pageMeta(page, limit, n) };
}

async function loadDetailRow(id) {
  const { rows } = await query(
    `SELECT s.*, c.nombre AS categoria, u.nombre AS anfitrion_nombre, u.estado AS anfitrion_estado,
            (SELECT COUNT(*) FROM calificacion k WHERE k.id_servicio = s.id_servicio AND k.estado = 'VISIBLE') AS total_calificaciones
       ${FROM} WHERE s.id_servicio = $1`,
    [id],
  );
  return rows[0];
}

// Un servicio inactivo, oculto o de un anfitrión suspendido solo lo ven su propietario y el administrador.
export async function getVisible(id, viewer) {
  const s = await loadDetailRow(id);
  const esPropietario = viewer && s && viewer.id_usuario === s.id_anfitrion;
  const esAdmin = viewer?.rol === 'ADMINISTRADOR';
  const publico = s && s.estado === 'ACTIVO' && s.anfitrion_estado === 'ACTIVO';
  if (!s || !(publico || esPropietario || esAdmin)) throw notFound('Servicio no encontrado');
  return s;
}

export async function getDetail(id, viewer) {
  const s = await getVisible(id, viewer);
  const { rows: fotos } = await query(
    'SELECT id_foto, url, orden, es_principal FROM foto_servicio WHERE id_servicio = $1 ORDER BY es_principal DESC, orden, id_foto',
    [id],
  );
  return {
    id_servicio: s.id_servicio,
    tipo: s.tipo,
    titulo: s.titulo,
    descripcion: s.descripcion,
    precio_base: s.precio_base,
    capacidad_max: s.capacidad_max,
    localidad: s.localidad,
    direccion: s.direccion,
    latitud: s.latitud,
    longitud: s.longitud,
    contacto: s.contacto,
    id_categoria: s.id_categoria,
    categoria: s.categoria,
    estado: s.estado,
    promedio_calificacion: s.promedio_calificacion,
    total_calificaciones: s.total_calificaciones,
    fecha_creacion: s.fecha_creacion,
    fotos: fotos.map((f) => ({ ...f, url: abs(f.url) })),
    anfitrion: { id_usuario: s.id_anfitrion, nombre: s.anfitrion_nombre },
  };
}

// Devuelve el servicio si pertenece al usuario (403 si es de otro, 404 si no existe).
export async function getOwned(runner, user, id) {
  const { rows } = await runner.query('SELECT * FROM servicio WHERE id_servicio = $1', [id]);
  if (!rows[0]) throw notFound('Servicio no encontrado');
  if (rows[0].id_anfitrion !== user.id_usuario) throw forbidden('Solo el propietario puede modificar esta publicación', 'NO_ES_PROPIETARIO');
  return rows[0];
}

async function assertCategoriaActiva(id) {
  const { rows } = await query('SELECT activa FROM categoria WHERE id_categoria = $1', [id]);
  if (!rows[0]) throw badRequest('La categoría no existe', 'CATEGORIA_INVALIDA');
  if (!rows[0].activa) throw badRequest('La categoría está desactivada', 'CATEGORIA_INACTIVA');
}

export async function create(user, input) {
  if (!TIPOS_POR_ROL[user.rol]?.includes(input.tipo)) {
    throw forbidden(`Con el rol ${user.rol} no puedes publicar servicios de tipo ${input.tipo}`, 'TIPO_NO_PERMITIDO');
  }
  await assertCategoriaActiva(input.id_categoria);
  const { rows } = await query(
    `INSERT INTO servicio (id_anfitrion, id_categoria, tipo, titulo, descripcion, precio_base, capacidad_max, localidad, direccion, latitud, longitud, contacto)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id_servicio`,
    [user.id_usuario, input.id_categoria, input.tipo, input.titulo, input.descripcion, input.precio_base ?? null, input.capacidad_max ?? null,
      input.localidad, input.direccion ?? null, input.latitud ?? null, input.longitud ?? null, input.contacto ?? null],
  );
  return getDetail(rows[0].id_servicio, user);
}

export async function update(user, id, patch) {
  const current = await getOwned({ query }, user, id);
  if (current.estado === 'OCULTO') throw forbidden('Esta publicación fue ocultada por moderación y no puede modificarse', 'SERVICIO_OCULTO');
  const errs = invariantErrors({ ...current, ...patch });
  if (errs.length) throw badRequest('Hay datos inválidos en la solicitud', 'VALIDACION', errs.map((e) => ({ ...e, en: 'body' })));
  if (patch.id_categoria && patch.id_categoria !== current.id_categoria) await assertCategoriaActiva(patch.id_categoria);
  const sets = [];
  const params = [id];
  for (const key of EDITABLES) {
    if (key in patch) { params.push(patch[key]); sets.push(`${key} = $${params.length}`); }
  }
  if (sets.length) await query(`UPDATE servicio SET ${sets.join(', ')} WHERE id_servicio = $1`, params);
  return getDetail(id, user);
}

// RF-08 / RF-32: si el servicio tiene reservas (activas o históricas) nunca se borra físicamente:
// el propietario lo desactiva y el administrador lo oculta. Sin reservas, se elimina con sus fotos.
export async function remove(user, id, { comoAdmin = false } = {}) {
  const result = await withTransaction(async (c) => {
    const { rows } = await c.query('SELECT * FROM servicio WHERE id_servicio = $1 FOR UPDATE', [id]);
    const s = rows[0];
    if (!s) throw notFound('Servicio no encontrado');
    if (!comoAdmin && s.id_anfitrion !== user.id_usuario) throw forbidden('Solo el propietario puede eliminar esta publicación', 'NO_ES_PROPIETARIO');
    const { rows: [{ total }] } = await c.query('SELECT COUNT(*) AS total FROM reserva WHERE id_servicio = $1', [id]);
    if (total > 0) {
      const estado = comoAdmin || s.estado === 'OCULTO' ? 'OCULTO' : 'INACTIVO';
      await c.query('UPDATE servicio SET estado = $2 WHERE id_servicio = $1', [id, estado]);
      return { eliminado: false, estado, id_anfitrion: s.id_anfitrion, titulo: s.titulo, urls: [] };
    }
    const { rows: fotos } = await c.query('SELECT url FROM foto_servicio WHERE id_servicio = $1', [id]);
    await c.query('DELETE FROM servicio WHERE id_servicio = $1', [id]);
    return { eliminado: true, estado: null, id_anfitrion: s.id_anfitrion, titulo: s.titulo, urls: fotos.map((f) => f.url) };
  });
  await Promise.all(result.urls.map(deleteImage));
  const { urls, ...visible } = result;
  return visible;
}
