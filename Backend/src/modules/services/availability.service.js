import { query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict } from '../../utils/errors.js';
import { addDays, diffDays, todayISO } from '../../utils/dates.js';
import { getOwned, getVisible } from './services.service.js';

function assertReservable(servicio) {
  if (servicio.tipo === 'NEGOCIO_LOCAL') throw badRequest('Los negocios locales no manejan disponibilidad ni reservas', 'SERVICIO_NO_RESERVABLE');
}

// RF-18: calendario público de cupos por día. Los días sin registro se consideran no disponibles.
export async function getAvailability(id, { desde, hasta }, viewer) {
  const s = await getVisible(id, viewer);
  if (s.tipo === 'NEGOCIO_LOCAL') return { id_servicio: id, tipo: s.tipo, reservable: false, dias: [] };
  const from = desde ?? todayISO();
  const to = hasta ?? addDays(from, 59);
  if (to < from) throw badRequest('La fecha final no puede ser anterior a la inicial', 'RANGO_INVALIDO');
  if (diffDays(to, from) > 365) throw badRequest('El rango máximo es de 366 días', 'RANGO_INVALIDO');
  const { rows } = await query(
    `SELECT fecha, cupos_totales, cupos_disponibles FROM disponibilidad
      WHERE id_servicio = $1 AND fecha BETWEEN $2::date AND $3::date ORDER BY fecha`,
    [id, from, to],
  );
  return { id_servicio: id, tipo: s.tipo, reservable: true, desde: from, hasta: to, dias: rows.map((r) => ({ ...r, disponible: r.cupos_disponibles > 0 })) };
}

// RF-17: el anfitrión define un periodo con cupos por día. Se guarda día a día para controlar la concurrencia.
export async function setAvailability(user, id, { desde, hasta, cupos_totales: cupos }) {
  const servicio = await getOwned({ query }, user, id);
  assertReservable(servicio);
  if (desde < todayISO()) throw badRequest('No se puede definir disponibilidad en fechas pasadas', 'FECHA_PASADA');
  return withTransaction(async (c) => {
    await c.query('SELECT 1 FROM servicio WHERE id_servicio = $1 FOR SHARE', [id]);
    const { rows: conflictos } = await c.query(
      `SELECT fecha FROM disponibilidad
        WHERE id_servicio = $1 AND fecha BETWEEN $2::date AND $3::date AND (cupos_totales - cupos_disponibles) > $4::int
        ORDER BY fecha FOR UPDATE`,
      [id, desde, hasta, cupos],
    );
    if (conflictos.length) {
      throw conflict('Hay días con más cupos reservados que el nuevo total', 'CUPOS_INFERIORES_A_RESERVADOS', { fechas: conflictos.map((r) => r.fecha) });
    }
    const { rowCount } = await c.query(
      `INSERT INTO disponibilidad (id_servicio, fecha, cupos_totales, cupos_disponibles)
       SELECT $1::int, ($2::date + g)::date, $4::int, $4::int FROM generate_series(0, $3::date - $2::date) g
       ON CONFLICT (id_servicio, fecha) DO UPDATE
         SET cupos_totales = EXCLUDED.cupos_totales,
             cupos_disponibles = EXCLUDED.cupos_totales - (disponibilidad.cupos_totales - disponibilidad.cupos_disponibles),
             version = disponibilidad.version + 1`,
      [id, desde, hasta, cupos],
    );
    return { id_servicio: id, desde, hasta, cupos_totales: cupos, dias_actualizados: rowCount };
  });
}

// RF-17: bloquear fechas. Solo se bloquean los días sin reservas; los demás se informan en con_reservas.
export async function blockDates(user, id, { desde, hasta }) {
  const servicio = await getOwned({ query }, user, id);
  assertReservable(servicio);
  return withTransaction(async (c) => {
    await c.query(
      'SELECT id_disponibilidad FROM disponibilidad WHERE id_servicio = $1 AND fecha BETWEEN $2::date AND $3::date ORDER BY fecha FOR UPDATE',
      [id, desde, hasta],
    );
    const { rows: bloqueadas } = await c.query(
      `UPDATE disponibilidad SET cupos_totales = 0, cupos_disponibles = 0, version = version + 1
        WHERE id_servicio = $1 AND fecha BETWEEN $2::date AND $3::date AND cupos_disponibles = cupos_totales AND cupos_totales > 0
        RETURNING fecha`,
      [id, desde, hasta],
    );
    const { rows: conReservas } = await c.query(
      'SELECT fecha FROM disponibilidad WHERE id_servicio = $1 AND fecha BETWEEN $2::date AND $3::date AND cupos_totales > cupos_disponibles ORDER BY fecha',
      [id, desde, hasta],
    );
    return { id_servicio: id, bloqueadas: bloqueadas.map((r) => r.fecha).sort(), con_reservas: conReservas.map((r) => r.fecha) };
  });
}
