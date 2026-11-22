import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config/env.js';
import { badRequest } from '../utils/errors.js';

// Convierte cualquier imagen válida a WebP optimizado (RNF-21). Decodificar con sharp también
// garantiza que el archivo realmente es una imagen (OWASP: carga segura de archivos).
// Para producción se puede reemplazar por un almacenamiento de objetos (S3, Cloud Storage) + CDN (RNF-12).
export async function saveImage(buffer) {
  let output;
  try {
    output = await sharp(buffer, { failOn: 'error' })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw badRequest('El archivo no es una imagen válida', 'IMAGEN_INVALIDA');
  }
  await fs.mkdir(config.uploads.dir, { recursive: true });
  const name = `${randomUUID()}.webp`;
  await fs.writeFile(path.join(config.uploads.dir, name), output);
  return `/uploads/${name}`;
}

export async function deleteImage(url) {
  if (!url) return;
  try {
    await fs.unlink(path.join(config.uploads.dir, path.basename(url)));
  } catch {
    /* si el archivo ya no existe no pasa nada */
  }
}
