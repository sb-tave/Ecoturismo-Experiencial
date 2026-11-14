import { query, withTransaction } from '../../db/pool.js';
import { config } from '../../config/env.js';
import { badRequest, conflict, notFound } from '../../utils/errors.js';
import { deleteImage, saveImage } from '../../services/storage.js';
import { abs, getOwned } from './services.service.js';

// RF-09: subir, ordenar y eliminar fotografías de una publicación o de un negocio local.
export async function addPhoto(user, servicioId, file) {
  if (!file) throw badRequest('Envía una imagen en el campo «foto»', 'FOTO_REQUERIDA');
  await getOwned({ query }, user, servicioId);
  const { rows: [{ n }] } = await query('SELECT COUNT(*) AS n FROM foto_servicio WHERE id_servicio = $1', [servicioId]);
  if (n >= config.uploads.maxPerService) throw conflict(`Máximo ${config.uploads.maxPerService} fotos por publicación`, 'LIMITE_DE_FOTOS');
  const url = await saveImage(file.buffer);
  try {
    const foto = await withTransaction(async (c) => {
      await c.query('SELECT 1 FROM servicio WHERE id_servicio = $1 FOR UPDATE', [servicioId]); // serializa cargas simultáneas
      const { rows: [{ cantidad, maximo }] } = await c.query(
        'SELECT COUNT(*) AS cantidad, COALESCE(MAX(orden), 0) AS maximo FROM foto_servicio WHERE id_servicio = $1',
        [servicioId],
      );
      const { rows } = await c.query(
        'INSERT INTO foto_servicio (id_servicio, url, orden, es_principal) VALUES ($1, $2, $3, $4) RETURNING id_foto, url, orden, es_principal',
        [servicioId, url, maximo + 1, cantidad === 0],
      );
      return rows[0];
    });
    return { ...foto, url: abs(foto.url) };
  } catch (err) {
    await deleteImage(url);
    throw err;
  }
}

export async function updatePhoto(user, servicioId, fotoId, patch) {
  await getOwned({ query }, user, servicioId);
  if (patch.es_principal === false) throw badRequest('Para cambiar la foto principal marca otra foto como principal', 'FOTO_PRINCIPAL_REQUERIDA');
  return withTransaction(async (c) => {
    const { rows } = await c.query('SELECT id_foto FROM foto_servicio WHERE id_foto = $1 AND id_servicio = $2 FOR UPDATE', [fotoId, servicioId]);
    if (!rows[0]) throw notFound('Foto no encontrada');
    if (patch.es_principal) await c.query('UPDATE foto_servicio SET es_principal = false WHERE id_servicio = $1 AND es_principal', [servicioId]);
    const { rows: [foto] } = await c.query(
      `UPDATE foto_servicio SET orden = COALESCE($2::int, orden), es_principal = es_principal OR $3::boolean
        WHERE id_foto = $1 RETURNING id_foto, url, orden, es_principal`,
      [fotoId, patch.orden ?? null, patch.es_principal === true],
    );
    return { ...foto, url: abs(foto.url) };
  });
}

export async function deletePhoto(user, servicioId, fotoId) {
  await getOwned({ query }, user, servicioId);
  const url = await withTransaction(async (c) => {
    const { rows } = await c.query('DELETE FROM foto_servicio WHERE id_foto = $1 AND id_servicio = $2 RETURNING url, es_principal', [fotoId, servicioId]);
    if (!rows[0]) throw notFound('Foto no encontrada');
    if (rows[0].es_principal) {
      await c.query(
        'UPDATE foto_servicio SET es_principal = true WHERE id_foto = (SELECT id_foto FROM foto_servicio WHERE id_servicio = $1 ORDER BY orden, id_foto LIMIT 1)',
        [servicioId],
      );
    }
    return rows[0].url;
  });
  await deleteImage(url);
}
