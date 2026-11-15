import { query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../utils/errors.js';
import { pageMeta } from '../../utils/schemas.js';
import { notify } from '../notifications/notifications.service.js';
import { recalcularPromedio } from '../reviews/reviews.service.js';

// RF-34: cualquier usuario registrado (menos el administrador) puede denunciar una publicación o una reseña.
export async function create(user, { id_servicio: idServicio, id_calificacion: idCalificacion, motivo }) {
  if (idServicio) {
    const { rows: [s] } = await query('SELECT id_anfitrion FROM servicio WHERE id_servicio = $1', [idServicio]);
    if (!s) throw notFound('Publicación no encontrada');
    if (s.id_anfitrion === user.id_usuario) throw badRequest('No puedes denunciar tu propia publicación', 'DENUNCIA_PROPIA');
  } else {
    const { rows: [k] } = await query("SELECT id_turista FROM calificacion WHERE id_calificacion = $1 AND estado = 'VISIBLE'", [idCalificacion]);
    if (!k) throw notFound('Reseña no encontrada');
    if (k.id_turista === user.id_usuario) throw badRequest('No puedes denunciar tu propia reseña', 'DENUNCIA_PROPIA');
  }
  try {
    const { rows: [d] } = await query(
      'INSERT INTO denuncia (id_denunciante, id_servicio, id_calificacion, motivo) VALUES ($1, $2, $3, $4) RETURNING id_denuncia, estado, fecha_creacion',
      [user.id_usuario, idServicio ?? null, idCalificacion ?? null, motivo],
    );
    return { ...d, id_servicio: idServicio ?? null, id_calificacion: idCalificacion ?? null, motivo };
  } catch (err) {
    if (err.code === '23505') throw conflict('Ya tienes una denuncia pendiente sobre este contenido', 'DENUNCIA_DUPLICADA');
    throw err;
  }
}

const DETALLE = `
  SELECT d.*, u.nombre AS denunciante_nombre, s.titulo AS servicio_titulo, s.estado AS servicio_estado,
         k.comentario AS calificacion_comentario, k.puntuacion AS calificacion_puntuacion, k.estado AS calificacion_estado
    FROM denuncia d JOIN usuario u ON u.id_usuario = d.id_denunciante
    LEFT JOIN servicio s ON s.id_servicio = d.id_servicio
    LEFT JOIN calificacion k ON k.id_calificacion = d.id_calificacion`;

const mapDenuncia = (d) => ({
  id_denuncia: d.id_denuncia,
  tipo: d.id_servicio ? 'PUBLICACION' : 'RESENA',
  objetivo: d.id_servicio
    ? { id_servicio: d.id_servicio, titulo: d.servicio_titulo, estado: d.servicio_estado }
    : { id_calificacion: d.id_calificacion, puntuacion: d.calificacion_puntuacion, comentario: d.calificacion_comentario, estado: d.calificacion_estado },
  motivo: d.motivo,
  estado: d.estado,
  denunciante: { id_usuario: d.id_denunciante, nombre: d.denunciante_nombre },
  id_admin: d.id_admin,
  fecha_creacion: d.fecha_creacion,
  fecha_resolucion: d.fecha_resolucion,
});

// RF-35: el administrador revisa la cola de denuncias.
export async function list({ estado, tipo, page, limit }) {
  const params = [];
  const where = [];
  if (estado) { params.push(estado); where.push(`d.estado = $${params.length}`); }
  if (tipo === 'PUBLICACION') where.push('d.id_servicio IS NOT NULL');
  if (tipo === 'RESENA') where.push('d.id_calificacion IS NOT NULL');
  const cond = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows: [{ n }] } = await query(`SELECT COUNT(*) AS n FROM denuncia d ${cond}`, params);
  params.push(limit, (page - 1) * limit);
  const { rows } = await query(`${DETALLE} ${cond} ORDER BY d.fecha_creacion ASC, d.id_denuncia ASC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  return { data: rows.map(mapDenuncia), meta: pageMeta(page, limit, n) };
}

async function getById(id) {
  const { rows } = await query(`${DETALLE} WHERE d.id_denuncia = $1`, [id]);
  if (!rows[0]) throw notFound('Denuncia no encontrada');
  return mapDenuncia(rows[0]);
}

// RF-35: resolver (OCULTAR el contenido) o desestimar. Queda el responsable y la fecha de resolución.
export async function resolve(admin, id, { accion }) {
  const afectado = await withTransaction(async (c) => {
    const { rows: [d] } = await c.query('SELECT * FROM denuncia WHERE id_denuncia = $1 FOR UPDATE', [id]);
    if (!d) throw notFound('Denuncia no encontrada');
    if (d.estado !== 'PENDIENTE') throw conflict('La denuncia ya fue atendida', 'DENUNCIA_ATENDIDA');
    let objetivo = null;
    if (accion === 'OCULTAR') {
      if (d.id_servicio) {
        const { rows: [s] } = await c.query("UPDATE servicio SET estado = 'OCULTO' WHERE id_servicio = $1 RETURNING id_anfitrion AS id_usuario, titulo", [d.id_servicio]);
        objetivo = { id_usuario: s.id_usuario, texto: `tu publicación «${s.titulo}»` };
      } else {
        const { rows: [k] } = await c.query("UPDATE calificacion SET estado = 'OCULTA' WHERE id_calificacion = $1 RETURNING id_turista AS id_usuario, id_servicio", [d.id_calificacion]);
        await recalcularPromedio(c, k.id_servicio);
        objetivo = { id_usuario: k.id_usuario, texto: 'tu reseña' };
      }
    }
    await c.query(
      'UPDATE denuncia SET estado = $2, id_admin = $3, fecha_resolucion = now() WHERE id_denuncia = $1',
      [id, accion === 'OCULTAR' ? 'RESUELTA' : 'DESESTIMADA', admin.id_usuario],
    );
    return objetivo && { ...objetivo, motivo: d.motivo };
  });
  if (afectado) {
    await notify(afectado.id_usuario, 'CONTENIDO_MODERADO', `Se ocultó ${afectado.texto} tras una denuncia por: ${afectado.motivo}.`, { correo: true, asunto: 'Contenido moderado' });
  }
  return getById(id);
}
