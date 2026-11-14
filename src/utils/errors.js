export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, code = 'SOLICITUD_INVALIDA', details) => new HttpError(400, code, message, details);
export const unauthorized = (message = 'No autenticado', code = 'NO_AUTENTICADO') => new HttpError(401, code, message);
export const forbidden = (message = 'No tienes permisos para esta acción', code = 'PROHIBIDO') => new HttpError(403, code, message);
export const notFound = (message = 'Recurso no encontrado', code = 'NO_ENCONTRADO') => new HttpError(404, code, message);
export const conflict = (message, code = 'CONFLICTO', details) => new HttpError(409, code, message, details);
