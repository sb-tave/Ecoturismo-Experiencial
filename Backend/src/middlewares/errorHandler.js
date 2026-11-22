import multer from 'multer';
import { HttpError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

export const notFoundHandler = (req, _res, next) =>
  next(new HttpError(404, 'RUTA_NO_ENCONTRADA', `Ruta no encontrada: ${req.method} ${req.path}`));

// Formato único de error: { error: { code, message, details? } }
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = 500;
  let code = 'ERROR_INTERNO';
  let message = 'Ocurrió un error interno. Intenta de nuevo más tarde';
  let details;

  if (err instanceof HttpError) {
    ({ status, code, message, details } = err);
  } else if (err?.type === 'entity.parse.failed') {
    status = 400; code = 'JSON_INVALIDO'; message = 'El cuerpo de la solicitud no es un JSON válido';
  } else if (err?.type === 'entity.too.large') {
    status = 413; code = 'CUERPO_MUY_GRANDE'; message = 'El cuerpo de la solicitud es demasiado grande';
  } else if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = 'ARCHIVO_INVALIDO';
    message = err.code === 'LIMIT_FILE_SIZE' ? `La imagen supera el máximo de ${config.uploads.maxMb} MB` : 'Archivo inválido: envíe una sola imagen en el campo «foto»';
  } else if (err?.code === '23505') {
    status = 409; code = 'DUPLICADO'; message = 'Ya existe un registro con esos datos';
  } else if (err?.code === '23503') {
    status = 409; code = 'REFERENCIA_INVALIDA'; message = 'La operación referencia datos inexistentes o en uso';
  } else if (err?.code === '23514') {
    status = 400; code = 'REGLA_DE_INTEGRIDAD'; message = 'Los datos no cumplen las reglas de integridad';
  }

  if (status >= 500) logger.error({ err, path: req.path }, 'error no controlado');
  res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
}
