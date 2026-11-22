import { config } from '../config/env.js';

// RNF-01: en producción todo el tráfico HTTP se redirige a HTTPS (los health checks quedan exentos).
export function httpsRedirect(req, res, next) {
  if (!config.forceHttps || req.secure || req.path.startsWith('/health')) return next();
  return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
}
