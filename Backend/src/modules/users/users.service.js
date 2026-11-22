import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { query, withTransaction } from '../../db/pool.js';
import { config } from '../../config/env.js';
import { conflict, forbidden, notFound } from '../../utils/errors.js';
import { publicUser } from './users.mapper.js';

export async function getById(id) {
  const { rows } = await query('SELECT * FROM usuario WHERE id_usuario = $1', [id]);
  if (!rows[0]) throw notFound('Usuario no encontrado');
  return publicUser(rows[0]);
}

export async function updateProfile(id, patch) {
  const sets = [];
  const params = [id];
  for (const key of ['nombre', 'telefono']) {
    if (key in patch) {
      params.push(patch[key]);
      sets.push(`${key} = $${params.length}`);
    }
  }
  if (!sets.length) return getById(id);
  const { rows } = await query(`UPDATE usuario SET ${sets.join(', ')} WHERE id_usuario = $1 RETURNING *`, params);
  return publicUser(rows[0]);
}

export async function changePassword(id, actual, nueva) {
  const { rows } = await query('SELECT contrasena_hash FROM usuario WHERE id_usuario = $1', [id]);
  if (!(await bcrypt.compare(actual, rows[0].contrasena_hash))) throw forbidden('La contraseña actual no es correcta', 'CONTRASENA_INCORRECTA');
  await query('UPDATE usuario SET contrasena_hash = $2 WHERE id_usuario = $1', [id, await bcrypt.hash(nueva, config.bcryptRounds)]);
}

// RNF-07: eliminación de la cuenta = anonimización. Las reservas se conservan sin datos personales (reportes).
export async function deleteAccount(user, contrasena) {
  if (user.rol === 'ADMINISTRADOR') throw forbidden('Las cuentas de administrador no se eliminan desde la aplicación', 'ADMIN_NO_ELIMINABLE');
  const randomHash = await bcrypt.hash(randomBytes(24).toString('hex'), 4);
  await withTransaction(async (c) => {
    const { rows } = await c.query('SELECT contrasena_hash FROM usuario WHERE id_usuario = $1 FOR UPDATE', [user.id_usuario]);
    if (!(await bcrypt.compare(contrasena, rows[0].contrasena_hash))) throw forbidden('La contraseña no es correcta', 'CONTRASENA_INCORRECTA');
    const { rows: [activas] } = await c.query(
      `SELECT COUNT(*) AS n FROM reserva r JOIN servicio s ON s.id_servicio = r.id_servicio
        WHERE r.estado IN ('PENDIENTE_PAGO','CONFIRMADA') AND (r.id_turista = $1 OR s.id_anfitrion = $1)`,
      [user.id_usuario],
    );
    if (activas.n > 0) throw conflict('Tienes reservas activas. Cancélalas o espera a que finalicen antes de eliminar tu cuenta', 'TIENE_RESERVAS_ACTIVAS');
    await c.query("UPDATE servicio SET estado = 'INACTIVO' WHERE id_anfitrion = $1 AND estado = 'ACTIVO'", [user.id_usuario]);
    await c.query('DELETE FROM notificacion WHERE id_usuario = $1', [user.id_usuario]);
    await c.query(
      `UPDATE usuario SET nombre = 'Usuario eliminado', correo = 'eliminado-' || id_usuario || '@eliminado.invalid',
              contrasena_hash = $2, telefono = NULL, estado = 'ELIMINADO', eliminado_en = now()
        WHERE id_usuario = $1`,
      [user.id_usuario, randomHash],
    );
  });
}
