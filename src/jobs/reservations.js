import { query, withTransaction } from '../db/pool.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { codigoReserva, liberarYCancelar } from '../modules/bookings/bookings.service.js';
import { notify } from '../modules/notifications/notifications.service.js';

// RF-22: las reservas sin pago vencidas se cancelan y liberan su cupo.
// FOR UPDATE SKIP LOCKED permite que varias instancias del backend corran la tarea sin pisarse (RNF-10).
export async function expirarReservasPendientes() {
  const expiradas = await withTransaction(async (c) => {
    const { rows } = await c.query(
      `SELECT r.*, s.tipo, s.titulo FROM reserva r JOIN servicio s ON s.id_servicio = r.id_servicio
        WHERE r.estado = 'PENDIENTE_PAGO' AND r.expira_en < now()
        ORDER BY r.id_reserva LIMIT 100 FOR UPDATE OF r SKIP LOCKED`,
    );
    for (const r of rows) await liberarYCancelar(c, r);
    return rows;
  });
  for (const r of expiradas) {
    await notify(r.id_turista, 'RESERVA_EXPIRADA', `Tu reserva ${codigoReserva(r.id_reserva)} de ${r.titulo} venció por falta de pago y se canceló.`);
  }
  return expiradas.length;
}

// RF-21: una reserva confirmada pasa a COMPLETADA cuando termina la fecha de la estadía o actividad.
export async function completarReservas() {
  const { rowCount } = await query(
    "UPDATE reserva SET estado = 'COMPLETADA' WHERE estado = 'CONFIRMADA' AND fecha_fin < (now() AT TIME ZONE $1)::date",
    [config.timezone],
  );
  return rowCount;
}

let timer;
export function startJobs() {
  const run = async () => {
    try {
      const expiradas = await expirarReservasPendientes();
      const completadas = await completarReservas();
      if (expiradas || completadas) logger.info({ expiradas, completadas }, 'tareas programadas ejecutadas');
    } catch (err) {
      logger.error({ err }, 'falló la tarea programada de reservas');
    }
  };
  run();
  timer = setInterval(run, config.jobsIntervalSeconds * 1000);
  timer.unref();
}
export const stopJobs = () => clearInterval(timer);
