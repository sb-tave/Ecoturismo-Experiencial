import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { query } from '../db/pool.js';
import { asyncHandler } from '../utils/async.js';
import { forbidden, unauthorized } from '../utils/errors.js';

export const signToken = (user) =>
  jwt.sign({ sub: String(user.id_usuario), rol: user.rol }, config.jwt.secret, { algorithm: 'HS256', expiresIn: config.jwt.expiresIn });

// Valida el token y carga el usuario desde la base: una suspensión surte efecto de inmediato (RF-31).
async function loadUser(req) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
  } catch {
    throw unauthorized('Token inválido o vencido', 'TOKEN_INVALIDO');
  }
  const { rows } = await query('SELECT id_usuario, nombre, correo, telefono, rol, estado FROM usuario WHERE id_usuario = $1', [Number(payload.sub)]);
  const user = rows[0];
  if (!user || user.estado === 'ELIMINADO') throw unauthorized('Token inválido o vencido', 'TOKEN_INVALIDO');
  if (user.estado === 'SUSPENDIDO') throw forbidden('Tu cuenta está suspendida', 'CUENTA_SUSPENDIDA');
  return user;
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const user = await loadUser(req);
  if (!user) throw unauthorized('Debes iniciar sesión', 'NO_AUTENTICADO');
  req.user = user;
  next();
});

// Endpoints públicos que muestran más información si hay una sesión válida.
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  req.user = (await loadUser(req)) || null;
  next();
});

// RF-04: cada rol solo usa las funciones que le corresponden (si no, 403).
export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.rol) ? next() : next(forbidden('Tu rol no tiene permiso para esta acción'));
