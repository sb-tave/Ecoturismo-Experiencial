import { query } from '../../db/pool.js';
import { conflict, notFound } from '../../utils/errors.js';

const SELECT = `
  SELECT c.id_categoria, c.nombre, c.descripcion, c.activa,
         COUNT(s.id_servicio) FILTER (WHERE s.estado = 'ACTIVO') AS total_servicios
    FROM categoria c LEFT JOIN servicio s ON s.id_categoria = c.id_categoria`;

export async function list({ incluirInactivas = false } = {}) {
  const { rows } = await query(`${SELECT} ${incluirInactivas ? '' : 'WHERE c.activa'} GROUP BY c.id_categoria ORDER BY c.nombre`);
  return rows;
}

async function getById(id) {
  const { rows } = await query(`${SELECT} WHERE c.id_categoria = $1 GROUP BY c.id_categoria`, [id]);
  if (!rows[0]) throw notFound('Categoría no encontrada');
  return rows[0];
}

export async function create({ nombre, descripcion }) {
  try {
    const { rows } = await query('INSERT INTO categoria (nombre, descripcion) VALUES ($1, $2) RETURNING id_categoria', [nombre, descripcion ?? null]);
    return getById(rows[0].id_categoria);
  } catch (err) {
    if (err.code === '23505') throw conflict('Ya existe una categoría con ese nombre', 'CATEGORIA_DUPLICADA');
    throw err;
  }
}

export async function update(id, patch) {
  await getById(id);
  const sets = [];
  const params = [id];
  for (const key of ['nombre', 'descripcion', 'activa']) {
    if (key in patch) {
      params.push(patch[key]);
      sets.push(`${key} = $${params.length}`);
    }
  }
  try {
    if (sets.length) await query(`UPDATE categoria SET ${sets.join(', ')} WHERE id_categoria = $1`, params);
  } catch (err) {
    if (err.code === '23505') throw conflict('Ya existe una categoría con ese nombre', 'CATEGORIA_DUPLICADA');
    throw err;
  }
  return getById(id);
}

// RF-11: una categoría con servicios no se elimina, solo se desactiva.
export async function remove(id) {
  await getById(id);
  const { rows } = await query('SELECT COUNT(*) AS n FROM servicio WHERE id_categoria = $1', [id]);
  if (rows[0].n > 0) {
    await query('UPDATE categoria SET activa = false WHERE id_categoria = $1', [id]);
    return { eliminada: false, desactivada: true, mensaje: 'La categoría tiene servicios asociados, por eso solo se desactivó' };
  }
  await query('DELETE FROM categoria WHERE id_categoria = $1', [id]);
  return { eliminada: true, desactivada: false, mensaje: 'Categoría eliminada' };
}
