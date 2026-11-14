import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

const make = (opts) =>
  config.rateLimit.enabled
    ? rateLimit({
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { error: { code: 'DEMASIADAS_SOLICITUDES', message: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos' } },
        ...opts,
      })
    : (_req, _res, next) => next();

export const globalLimiter = make({ windowMs: 15 * 60 * 1000, limit: config.rateLimit.global });
// Más estricto en autenticación para frenar ataques de fuerza bruta (OWASP A07).
export const authLimiter = make({ windowMs: 15 * 60 * 1000, limit: config.rateLimit.auth });
