import { query } from '../../db/pool.js';
import { config } from '../../config/env.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import { addDays, todayISO } from '../../utils/dates.js';
import { escapeLike, pageMeta } from '../../utils/schemas.js';
import { notify } from '../notifications/notifications.service.js';
import { recalcularPromedio } from '../reviews/reviews.service.js';
import * as servicesService from '../services/services.service.js';
import { publicUser } from '../users/users.mapper.js';

// ---------- RF-31: gestión de usuarios ----------
export async function listUsers({ rol, estado, q, page, limit }) {
  const params = [];
  const where = [];
  if (rol) { params.push(rol); where.push(`rol = $${params.length}`); }
  if (estado) { params.push(estado); where.push(`estado = $${params.length}`); }
  if (q) { params.push(`%${escapeLike(q)}%`); where.push(`(nombre ILIKE $${params.length} OR correo ILIKE $${params.length})`); }
  const cond = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows: [{ n }] } = await query(`SELECT COUNT(*) AS n FROM usuario ${cond}`, params);
  params.push(limit, (page - 1) * limit);
  const { rows } = await query(`SELECT * FROM usuario ${cond} ORDER BY fecha_registro DESC, id_usuario DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  return { data: rows.map(publicUser), meta: pageMeta(page, limit, n) };
}

export async function setUserStatus(admin, id, { estado }) {
  if (id === admin.id_usuario) throw badRequest('No puedes cambiar el estado de tu propia cuenta', 'CUENTA_PROPIA');
  const { rows: [u] } = await query('SELECT * FROM usuario WHERE id_usuario = $1', [id]);
  if (!u) throw notFound('Usuario no encontrado');
  if (u.rol === 'ADMINISTRADOR') throw forbidden('No se pueden modificar cuentas de administrador', 'ADMIN_PROTEGIDO');
  if (u.estado === 'ELIMINADO') throw conflict('La cuenta ya fue eliminada', 'CUENTA_ELIMINADA');
  const { rows: [actualizado] } = await query('UPDATE usuario SET estado = $2 WHERE id_usuario = $1 RETURNING *', [id, estado]);
  return publicUser(actualizado);
}

// ---------- RF-32: moderación de publicaciones ----------
export async function listServices({ estado, q, page, limit }) {
  const params = [];
  const where = [];
  if (estado) { params.push(estado); where.push(`s.estado = $${params.length}`); }
  if (q) { params.push(`%${escapeLike(q)}%`); where.push(`(s.titulo ILIKE $${params.length} OR s.localidad ILIKE $${params.length})`); }
  const cond = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows: [{ n }] } = await query(`SELECT COUNT(*) AS n FROM servicio s ${cond}`, params);
  params.push(limit, (page - 1) * limit);
  const { rows } = await query(
    `SELECT s.id_servicio, s.tipo, s.titulo, s.localidad, s.estado, s.id_anfitrion, u.nombre AS anfitrion_nombre, s.fecha_creacion
       FROM servicio s JOIN usuario u ON u.id_usuario = s.id_anfitrion ${cond}
      ORDER BY s.fecha_creacion DESC, s.id_servicio DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { data: rows, meta: pageMeta(page, limit, n) };
}

export async function moderateService(admin, id, { accion, motivo }) {
  const { rows: [s] } = await query('SELECT id_servicio, id_anfitrion, titulo, estado FROM servicio WHERE id_servicio = $1', [id]);
  if (!s) throw notFound('Servicio no encontrado');
  if (accion === 'OCULTAR') {
    if (s.estado === 'OCULTO') throw conflict('La publicación ya está oculta', 'YA_OCULTA');
    await query("UPDATE servicio SET estado = 'OCULTO' WHERE id_servicio = $1", [id]);
    await notify(s.id_anfitrion, 'CONTENIDO_MODERADO', `Tu publicación «${s.titulo}» fue ocultada por moderación. Motivo: ${motivo}.`, { correo: true, asunto: 'Publicación ocultada' });
  } else {
    if (s.estado !== 'OCULTO') throw conflict('La publicación no está oculta', 'NO_ESTA_OCULTA');
    await query("UPDATE servicio SET estado = 'ACTIVO' WHERE id_servicio = $1", [id]);
    await notify(s.id_anfitrion, 'CONTENIDO_MODERADO', `Tu publicación «${s.titulo}» fue restaurada y vuelve a estar visible.`);
  }
  return servicesService.getDetail(id, admin);
}

export async function deleteService(admin, id, { motivo }) {
  const r = await servicesService.remove(admin, id, { comoAdmin: true });
  await notify(
    r.id_anfitrion,
    'CONTENIDO_MODERADO',
    `Tu publicación «${r.titulo}» ${r.eliminado ? 'fue eliminada' : 'fue ocultada (tiene reservas y no se puede borrar)'} por moderación. Motivo: ${motivo}.`,
    { correo: true, asunto: 'Publicación moderada' },
  );
  return { eliminado: r.eliminado, estado: r.estado, mensaje: r.eliminado ? 'Publicación eliminada' : 'La publicación tiene reservas, por eso se ocultó en lugar de eliminarse' };
}

// ---------- RF-33: moderación de reseñas ----------
export async function listReviews({ estado, id_servicio: idServicio, page, limit }) {
  const params = [];
  const where = [];
  if (estado) { params.push(estado); where.push(`k.estado = $${params.length}`); }
  if (idServicio) { params.push(idServicio); where.push(`k.id_servicio = $${params.length}`); }
  const cond = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows: [{ n }] } = await query(`SELECT COUNT(*) AS n FROM calificacion k ${cond}`, params);
  params.push(limit, (page - 1) * limit);
  const { rows } = await query(
    `SELECT k.id_calificacion, k.id_servicio, s.titulo AS servicio_titulo, k.id_turista, u.nombre AS autor, k.puntuacion, k.comentario, k.estado, k.fecha
       FROM calificacion k JOIN servicio s ON s.id_servicio = k.id_servicio JOIN usuario u ON u.id_usuario = k.id_turista ${cond}
      ORDER BY k.fecha DESC, k.id_calificacion DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { data: rows, meta: pageMeta(page, limit, n) };
}

export async function moderateReview(id, { accion, motivo }) {
  const { rows: [k] } = await query('SELECT id_calificacion, id_servicio, id_turista, estado FROM calificacion WHERE id_calificacion = $1', [id]);
  if (!k) throw notFound('Reseña no encontrada');
  const nuevo = accion === 'OCULTAR' ? 'OCULTA' : 'VISIBLE';
  if (k.estado === nuevo) throw conflict(`La reseña ya está ${nuevo === 'OCULTA' ? 'oculta' : 'visible'}`, 'SIN_CAMBIOS');
  await query('UPDATE calificacion SET estado = $2 WHERE id_calificacion = $1', [id, nuevo]);
  await recalcularPromedio({ query }, k.id_servicio);
  if (accion === 'OCULTAR') await notify(k.id_turista, 'CONTENIDO_MODERADO', `Tu reseña fue ocultada por moderación. Motivo: ${motivo}.`, { correo: true, asunto: 'Reseña ocultada' });
  return { id_calificacion: id, estado: nuevo };
}

export async function deleteReview(id, { motivo }) {
  const { rows: [k] } = await query('DELETE FROM calificacion WHERE id_calificacion = $1 RETURNING id_servicio, id_turista', [id]);
  if (!k) throw notFound('Reseña no encontrada');
  await recalcularPromedio({ query }, k.id_servicio);
  await notify(k.id_turista, 'CONTENIDO_MODERADO', `Tu reseña fue eliminada por moderación. Motivo: ${motivo}.`, { correo: true, asunto: 'Reseña eliminada' });
  return { mensaje: 'Reseña eliminada' };
}

// ---------- RF-37: reportes básicos de reservas e ingresos ----------
export async function summary({ desde, hasta }) {
  const hoy = todayISO();
  const rango = { desde: desde ?? addDays(hoy, -29), hasta: hasta ?? hoy };
  const p = [rango.desde, rango.hasta, config.timezone];
  const enRango = (col) => `(${col} AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date`;

  const { rows: porEstado } = await query(`SELECT estado, COUNT(*) AS n FROM reserva r WHERE ${enRango('r.fecha_creacion')} GROUP BY estado`, p);
  const reservas = { PENDIENTE_PAGO: 0, CONFIRMADA: 0, COMPLETADA: 0, CANCELADA: 0 };
  for (const f of porEstado) reservas[f.estado] = f.n;

  const { rows: [ingresos] } = await query(
    `SELECT COALESCE(SUM(monto), 0) AS total, COUNT(*) AS pagos FROM pago WHERE estado = 'APROBADO' AND ${enRango('fecha_pago')}`,
    p,
  );
  const { rows: top } = await query(
    `SELECT s.id_servicio, s.titulo, s.tipo, COUNT(DISTINCT r.id_reserva) AS reservas, SUM(pg.monto) AS ingresos
       FROM pago pg JOIN reserva r ON r.id_reserva = pg.id_reserva JOIN servicio s ON s.id_servicio = r.id_servicio
      WHERE pg.estado = 'APROBADO' AND ${enRango('pg.fecha_pago')}
      GROUP BY s.id_servicio ORDER BY ingresos DESC, s.id_servicio LIMIT 5`,
    p,
  );
  const { rows: roles } = await query("SELECT rol, COUNT(*) AS n FROM usuario WHERE estado <> 'ELIMINADO' GROUP BY rol");
  const usuarios = { TURISTA: 0, ANFITRION: 0, NEGOCIO_LOCAL: 0, ADMINISTRADOR: 0 };
  for (const f of roles) usuarios[f.rol] = f.n;
  const { rows: [{ n: denuncias }] } = await query("SELECT COUNT(*) AS n FROM denuncia WHERE estado = 'PENDIENTE'");

  return {
    rango,
    reservas_por_estado: reservas,
    total_reservas: Object.values(reservas).reduce((a, b) => a + b, 0),
    ingresos: { total: ingresos.total, pagos_aprobados: ingresos.pagos },
    top_servicios: top,
    usuarios_por_rol: usuarios,
    denuncias_pendientes: denuncias,
  };
}
