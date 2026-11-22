import { query } from '../../db/pool.js';
import { logger } from '../../utils/logger.js';
import { notFound } from '../../utils/errors.js';
import { pageMeta } from '../../utils/schemas.js';
import { sendMail } from '../../services/mailer.js';

// Crea la notificación en la plataforma y, si se pide, también la envía por correo (RF-28).
// Nunca lanza errores: una notificación fallida no debe romper el flujo que la originó.
export async function notify(idUsuario, tipo, mensaje, { correo = false, asunto } = {}) {
  try {
    await query('INSERT INTO notificacion (id_usuario, tipo, mensaje) VALUES ($1, $2, $3)', [idUsuario, tipo, mensaje.slice(0, 255)]);
    if (correo) {
      const { rows } = await query('SELECT correo, estado FROM usuario WHERE id_usuario = $1', [idUsuario]);
      if (rows[0]?.estado === 'ACTIVO') await sendMail({ to: rows[0].correo, subject: asunto ?? 'Eco Turismo Experiencial', text: mensaje });
    }
  } catch (err) {
    logger.error({ err, tipo }, 'no se pudo crear la notificación');
  }
}

export async function list(user, { no_leidas: soloNoLeidas, page, limit }) {
  const filtro = soloNoLeidas ? 'AND NOT leida' : '';
  const { rows: [{ total }] } = await query(`SELECT COUNT(*) AS total FROM notificacion WHERE id_usuario = $1 ${filtro}`, [user.id_usuario]);
  const { rows: [{ pendientes }] } = await query('SELECT COUNT(*) AS pendientes FROM notificacion WHERE id_usuario = $1 AND NOT leida', [user.id_usuario]);
  const { rows } = await query(
    `SELECT id_notificacion, tipo, mensaje, leida, fecha_envio FROM notificacion WHERE id_usuario = $1 ${filtro}
      ORDER BY fecha_envio DESC, id_notificacion DESC LIMIT $2 OFFSET $3`,
    [user.id_usuario, limit, (page - 1) * limit],
  );
  return { data: rows, meta: { ...pageMeta(page, limit, total), no_leidas: pendientes } };
}

export async function markRead(user, id) {
  const { rows } = await query(
    'UPDATE notificacion SET leida = true WHERE id_notificacion = $1 AND id_usuario = $2 RETURNING id_notificacion, tipo, mensaje, leida, fecha_envio',
    [id, user.id_usuario],
  );
  if (!rows[0]) throw notFound('Notificación no encontrada');
  return rows[0];
}

export async function markAllRead(user) {
  const { rowCount } = await query('UPDATE notificacion SET leida = true WHERE id_usuario = $1 AND NOT leida', [user.id_usuario]);
  return { actualizadas: rowCount };
}
