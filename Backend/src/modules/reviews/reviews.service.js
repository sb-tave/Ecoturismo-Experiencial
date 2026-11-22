import { query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../utils/errors.js';
import { pageMeta } from '../../utils/schemas.js';
import { getVisible } from '../services/services.service.js';
import { notify } from '../notifications/notifications.service.js';

// El promedio visible del servicio se recalcula cada vez que una reseña se crea, oculta, restaura o elimina (RF-30).
export async function recalcularPromedio(runner, idServicio) {
  await runner.query(
    `UPDATE servicio SET promedio_calificacion =
       (SELECT ROUND(AVG(puntuacion)::numeric, 2) FROM calificacion WHERE id_servicio = $1 AND estado = 'VISIBLE')
      WHERE id_servicio = $1`,
    [idServicio],
  );
}

// Privacidad: las reseñas públicas muestran solo el nombre y la inicial del apellido.
const nombreCorto = (nombre) => {
  const [primero, segundo] = String(nombre).trim().split(/\s+/);
  return segundo ? `${primero} ${segundo[0].toUpperCase()}.` : primero;
};

// RF-29: solo se califica con una reserva COMPLETADA y pagada, y una sola vez por reserva.
export async function create(user, idServicio, { id_reserva: idReserva, puntuacion, comentario }) {
  const { reserva, id } = await withTransaction(async (c) => {
    const { rows: [r] } = await c.query(
      `SELECT r.*, s.id_anfitrion, s.titulo,
              EXISTS (SELECT 1 FROM pago p WHERE p.id_reserva = r.id_reserva AND p.estado = 'APROBADO') AS pagada
         FROM reserva r JOIN servicio s ON s.id_servicio = r.id_servicio WHERE r.id_reserva = $1 FOR SHARE OF r`,
      [idReserva],
    );
    if (!r || r.id_turista !== user.id_usuario) throw notFound('Reserva no encontrada');
    if (r.id_servicio !== idServicio) throw badRequest('La reserva no corresponde a este servicio', 'RESERVA_NO_COINCIDE');
    if (r.estado !== 'COMPLETADA' || !r.pagada) {
      throw conflict('Solo puedes calificar servicios de reservas completadas y pagadas', 'RESERVA_NO_CALIFICABLE');
    }
    let fila;
    try {
      ({ rows: [fila] } = await c.query(
        'INSERT INTO calificacion (id_reserva, id_servicio, id_turista, puntuacion, comentario) VALUES ($1, $2, $3, $4, $5) RETURNING id_calificacion',
        [idReserva, idServicio, user.id_usuario, puntuacion, comentario ?? null],
      ));
    } catch (err) {
      if (err.code === '23505') throw conflict('Ya calificaste esta reserva', 'YA_CALIFICADA');
      throw err;
    }
    await recalcularPromedio(c, idServicio);
    return { reserva: r, id: fila.id_calificacion };
  });
  await notify(reserva.id_anfitrion, 'NUEVA_CALIFICACION', `Recibiste una calificación de ${puntuacion}/5 en «${reserva.titulo}».`);
  return { id_calificacion: id, id_servicio: idServicio, id_reserva: idReserva, puntuacion, comentario: comentario ?? null };
}

// Público: reseñas visibles + resumen (promedio, total y distribución por estrellas).
export async function listByService(idServicio, { page, limit }, viewer) {
  await getVisible(idServicio, viewer);
  const { rows: dist } = await query(
    "SELECT puntuacion, COUNT(*) AS n FROM calificacion WHERE id_servicio = $1 AND estado = 'VISIBLE' GROUP BY puntuacion",
    [idServicio],
  );
  const distribucion = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  for (const f of dist) { distribucion[f.puntuacion] = f.n; total += f.n; }
  const { rows: [{ promedio_calificacion: promedio }] } = await query('SELECT promedio_calificacion FROM servicio WHERE id_servicio = $1', [idServicio]);
  const { rows } = await query(
    `SELECT k.id_calificacion, k.puntuacion, k.comentario, k.fecha, u.nombre, u.estado AS autor_estado
       FROM calificacion k JOIN usuario u ON u.id_usuario = k.id_turista
      WHERE k.id_servicio = $1 AND k.estado = 'VISIBLE' ORDER BY k.fecha DESC, k.id_calificacion DESC LIMIT $2 OFFSET $3`,
    [idServicio, limit, (page - 1) * limit],
  );
  return {
    data: rows.map((r) => ({
      id_calificacion: r.id_calificacion,
      puntuacion: r.puntuacion,
      comentario: r.comentario,
      fecha: r.fecha,
      autor: r.autor_estado === 'ELIMINADO' ? 'Usuario eliminado' : nombreCorto(r.nombre),
    })),
    meta: pageMeta(page, limit, total),
    resumen: { promedio, total, distribucion },
  };
}
