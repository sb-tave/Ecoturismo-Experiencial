import { query, withTransaction } from '../../db/pool.js';
import { config } from '../../config/env.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import { addDays, eachDay, todayISO } from '../../utils/dates.js';
import { pageMeta } from '../../utils/schemas.js';
import { notify } from '../notifications/notifications.service.js';

export const codigoReserva = (id) => `ECO-${String(id).padStart(6, '0')}`;
export const dinero = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
const round2 = (n) => Math.round(n * 100) / 100;

// Un alojamiento consume un cupo por NOCHE (el día de salida no cuenta);
// una actividad consume un cupo por PERSONA en cada día del rango.
export const cuposRequeridos = (tipo, personas) => (tipo === 'ACTIVIDAD' ? personas : 1);
export function diasConsumidos(tipo, inicio, fin) {
  const ultimo = tipo === 'ALOJAMIENTO' ? addDays(fin, -1) : fin;
  return { desde: inicio, hasta: ultimo, dias: eachDay(inicio, ultimo) };
}
// RF-19: el precio siempre se calcula en el backend. Alojamiento: precio por noche. Actividad: precio por persona y por día.
const calcularPrecio = (s, personas, dias) => round2(s.tipo === 'ALOJAMIENTO' ? s.precio_base * dias : s.precio_base * personas * dias);

export const mapReserva = (r, extra = {}) => ({
  id_reserva: r.id_reserva,
  codigo: codigoReserva(r.id_reserva),
  id_turista: r.id_turista,
  id_servicio: r.id_servicio,
  fecha_inicio: r.fecha_inicio,
  fecha_fin: r.fecha_fin,
  num_personas: r.num_personas,
  precio_total: r.precio_total,
  estado: r.estado,
  expira_en: r.expira_en,
  fecha_creacion: r.fecha_creacion,
  ...extra,
});

// RF-19 / RF-20: crea la reserva en estado PENDIENTE_PAGO descontando los cupos en una sola transacción.
export async function create(user, { id_servicio: idServicio, fecha_inicio: inicio, fecha_fin: fin, num_personas: personas }) {
  if (inicio < todayISO()) throw badRequest('La fecha de inicio no puede ser pasada', 'FECHA_PASADA');
  const { reserva, servicio } = await withTransaction(async (c) => {
    const { rows: [s] } = await c.query(
      `SELECT s.*, u.estado AS anfitrion_estado FROM servicio s JOIN usuario u ON u.id_usuario = s.id_anfitrion
        WHERE s.id_servicio = $1 FOR SHARE OF s`,
      [idServicio],
    );
    if (!s) throw notFound('Servicio no encontrado');
    if (s.estado !== 'ACTIVO' || s.anfitrion_estado !== 'ACTIVO') throw conflict('Este servicio no está disponible para reservas', 'SERVICIO_NO_DISPONIBLE');
    if (s.tipo === 'NEGOCIO_LOCAL') throw badRequest('Los negocios locales no admiten reservas', 'SERVICIO_NO_RESERVABLE');
    if (personas > s.capacidad_max) throw badRequest(`La capacidad máxima es de ${s.capacidad_max} personas`, 'CAPACIDAD_EXCEDIDA');
    if (s.tipo === 'ALOJAMIENTO' && fin <= inicio) throw badRequest('Un alojamiento requiere al menos una noche (la fecha de salida debe ser posterior a la de entrada)', 'RANGO_INVALIDO');
    const { desde, hasta, dias } = diasConsumidos(s.tipo, inicio, fin);
    if (dias.length > config.maxStayDays) throw badRequest(`La reserva no puede superar los ${config.maxStayDays} días`, 'ESTADIA_MUY_LARGA');
    const cupos = cuposRequeridos(s.tipo, personas);

    // Bloqueo pesimista en orden de fecha (evita deadlocks): las reservas simultáneas por el mismo cupo se serializan aquí.
    const { rows: disp } = await c.query(
      `SELECT id_disponibilidad, fecha, cupos_disponibles FROM disponibilidad
        WHERE id_servicio = $1 AND fecha BETWEEN $2::date AND $3::date ORDER BY fecha FOR UPDATE`,
      [idServicio, desde, hasta],
    );
    const porFecha = new Map(disp.map((d) => [d.fecha, d]));
    const sinCupo = dias.filter((d) => !porFecha.has(d) || porFecha.get(d).cupos_disponibles < cupos);
    if (sinCupo.length) throw conflict('No hay disponibilidad para todas las fechas solicitadas', 'SIN_DISPONIBILIDAD', { fechas_sin_disponibilidad: sinCupo });

    await c.query(
      'UPDATE disponibilidad SET cupos_disponibles = cupos_disponibles - $2::int, version = version + 1 WHERE id_disponibilidad = ANY($1::int[])',
      [disp.map((d) => d.id_disponibilidad), cupos],
    );
    const { rows: [r] } = await c.query(
      `INSERT INTO reserva (id_turista, id_servicio, fecha_inicio, fecha_fin, num_personas, precio_total, expira_en)
       VALUES ($1, $2, $3, $4, $5, $6, now() + make_interval(mins => $7::int)) RETURNING *`,
      [user.id_usuario, idServicio, inicio, fin, personas, calcularPrecio(s, personas, dias.length), config.reservationHoldMinutes],
    );
    return { reserva: r, servicio: s };
  });
  return mapReserva(reserva, {
    comprobante: {
      codigo: codigoReserva(reserva.id_reserva),
      servicio: servicio.titulo,
      tipo: servicio.tipo,
      localidad: servicio.localidad,
      fecha_inicio: reserva.fecha_inicio,
      fecha_fin: reserva.fecha_fin,
      num_personas: reserva.num_personas,
      total: reserva.precio_total,
      estado: reserva.estado,
      vence_en: reserva.expira_en,
      instrucciones: `Paga la reserva antes de que venza (${config.reservationHoldMinutes} minutos) o el cupo se liberará`,
    },
  });
}

// Libera los cupos de una reserva y la marca como CANCELADA (se usa al cancelar, al expirar y al pagar fuera de plazo).
// Debe llamarse dentro de una transacción con la fila de la reserva bloqueada.
export async function liberarYCancelar(c, r) {
  const { desde, hasta } = diasConsumidos(r.tipo, r.fecha_inicio, r.fecha_fin);
  await c.query(
    'SELECT id_disponibilidad FROM disponibilidad WHERE id_servicio = $1 AND fecha BETWEEN $2::date AND $3::date ORDER BY fecha FOR UPDATE',
    [r.id_servicio, desde, hasta],
  );
  await c.query(
    `UPDATE disponibilidad SET cupos_disponibles = LEAST(cupos_totales, cupos_disponibles + $4::int), version = version + 1
      WHERE id_servicio = $1 AND fecha BETWEEN $2::date AND $3::date`,
    [r.id_servicio, desde, hasta, cuposRequeridos(r.tipo, r.num_personas)],
  );
  await c.query("UPDATE reserva SET estado = 'CANCELADA', expira_en = NULL WHERE id_reserva = $1", [r.id_reserva]);
}

const estadoPago = (r) => {
  if (r.pagada) return 'APROBADO';
  if (r.estado === 'CANCELADA') return 'SIN_PAGO';
  return r.ultimo_pago === 'RECHAZADO' ? 'RECHAZADO' : 'PENDIENTE';
};

const LISTA_COLUMNAS = `
  r.*, s.titulo AS servicio_titulo, s.tipo AS servicio_tipo, s.localidad AS servicio_localidad, s.id_anfitrion, t.nombre AS turista_nombre,
  (SELECT p.estado FROM pago p WHERE p.id_reserva = r.id_reserva ORDER BY p.id_pago DESC LIMIT 1) AS ultimo_pago,
  EXISTS (SELECT 1 FROM pago p WHERE p.id_reserva = r.id_reserva AND p.estado = 'APROBADO') AS pagada,
  EXISTS (SELECT 1 FROM calificacion k WHERE k.id_reserva = r.id_reserva) AS calificada`;

const mapFila = (r) =>
  mapReserva(r, {
    servicio: { id_servicio: r.id_servicio, titulo: r.servicio_titulo, tipo: r.servicio_tipo, localidad: r.servicio_localidad },
    turista: { id_usuario: r.id_turista, nombre: r.turista_nombre },
    estado_pago: estadoPago(r),
    calificada: r.calificada,
  });

// RF-23 / RF-25 / RF-36: el turista ve las suyas, el anfitrión las de sus servicios y el administrador todas.
export async function list(user, f) {
  const params = [];
  const p = (v) => { params.push(v); return `$${params.length}`; };
  const where = [];
  if (user.rol === 'TURISTA') where.push(`r.id_turista = ${p(user.id_usuario)}`);
  else if (user.rol === 'ANFITRION') where.push(`s.id_anfitrion = ${p(user.id_usuario)}`);
  else if (user.rol !== 'ADMINISTRADOR') throw forbidden('Tu rol no tiene reservas');
  if (f.estado) where.push(`r.estado = ${p(f.estado)}`);
  if (f.id_servicio) where.push(`r.id_servicio = ${p(f.id_servicio)}`);
  if (f.desde) where.push(`r.fecha_inicio >= ${p(f.desde)}::date`);
  if (f.hasta) where.push(`r.fecha_inicio <= ${p(f.hasta)}::date`);
  const base = `FROM reserva r JOIN servicio s ON s.id_servicio = r.id_servicio JOIN usuario t ON t.id_usuario = r.id_turista
                WHERE ${where.length ? where.join(' AND ') : 'true'}`;
  const { rows: [{ n }] } = await query(`SELECT COUNT(*) AS n ${base}`, params);
  const { rows } = await query(
    `SELECT ${LISTA_COLUMNAS} ${base} ORDER BY r.fecha_creacion DESC, r.id_reserva DESC LIMIT ${p(f.limit)} OFFSET ${p((f.page - 1) * f.limit)}`,
    params,
  );
  return { data: rows.map(mapFila), meta: pageMeta(f.page, f.limit, n) };
}

export async function getById(user, id) {
  const { rows } = await query(`SELECT ${LISTA_COLUMNAS} FROM reserva r JOIN servicio s ON s.id_servicio = r.id_servicio JOIN usuario t ON t.id_usuario = r.id_turista WHERE r.id_reserva = $1`, [id]);
  const r = rows[0];
  const permitido = r && (user.rol === 'ADMINISTRADOR' || r.id_turista === user.id_usuario || r.id_anfitrion === user.id_usuario);
  if (!permitido) throw notFound('Reserva no encontrada');
  const { rows: pagos } = await query(
    'SELECT id_pago, monto, metodo, estado, referencia_pasarela, fecha_pago FROM pago WHERE id_reserva = $1 ORDER BY id_pago',
    [id],
  );
  return { ...mapFila(r), pagos };
}

// RF-24 (turista) y RF-36 (administrador): cancelar libera los cupos. No se cancelan reservas completadas ni ya canceladas.
export async function cancel(user, id, { motivo } = {}) {
  const r = await withTransaction(async (c) => {
    const { rows: [fila] } = await c.query(
      `SELECT r.*, s.tipo, s.titulo, s.id_anfitrion FROM reserva r JOIN servicio s ON s.id_servicio = r.id_servicio
        WHERE r.id_reserva = $1 FOR UPDATE OF r`,
      [id],
    );
    if (!fila || (user.rol !== 'ADMINISTRADOR' && fila.id_turista !== user.id_usuario)) throw notFound('Reserva no encontrada');
    if (!['PENDIENTE_PAGO', 'CONFIRMADA'].includes(fila.estado)) {
      throw conflict(`No se puede cancelar una reserva en estado ${fila.estado}`, 'RESERVA_NO_CANCELABLE');
    }
    await liberarYCancelar(c, fila);
    return fila;
  });
  const codigo = codigoReserva(r.id_reserva);
  const detalle = `${r.titulo} (${r.fecha_inicio} al ${r.fecha_fin})`;
  if (user.rol === 'ADMINISTRADOR') {
    const razon = motivo ? ` Motivo: ${motivo}.` : '';
    await notify(r.id_turista, 'RESERVA_CANCELADA', `El administrador canceló tu reserva ${codigo} de ${detalle}.${razon}`, { correo: true, asunto: `Reserva ${codigo} cancelada` });
    await notify(r.id_anfitrion, 'RESERVA_CANCELADA', `El administrador canceló la reserva ${codigo} de ${detalle}.${razon}`);
  } else {
    await notify(r.id_anfitrion, 'RESERVA_CANCELADA', `El turista canceló la reserva ${codigo} de ${detalle}.`);
  }
  return { mensaje: 'Reserva cancelada y cupos liberados', reserva: await getById(user, id) };
}
