import bcrypt from 'bcryptjs';
import { query } from '../../db/pool.js';
import { config } from '../../config/env.js';
import { conflict, forbidden, unauthorized } from '../../utils/errors.js';
import { signToken } from '../../middlewares/auth.js';
import { publicUser } from '../users/users.mapper.js';

// Se compara siempre contra un hash, exista o no el correo, para no revelar cuentas por tiempo de respuesta.
const DUMMY_HASH = bcrypt.hashSync('contrasena-ficticia-123', config.bcryptRounds);

export async function register(input) {
  if (input.politica_version && input.politica_version !== config.policyVersion) {
    throw conflict(`La política vigente es la versión ${config.policyVersion}`, 'POLITICA_DESACTUALIZADA');
  }
  const hash = await bcrypt.hash(input.contrasena, config.bcryptRounds);
  try {
    const { rows } = await query(
      `INSERT INTO usuario (nombre, correo, contrasena_hash, telefono, rol, politica_version, politica_aceptada_en)
       VALUES ($1, $2, $3, $4, $5, $6, now()) RETURNING *`,
      [input.nombre, input.correo, hash, input.telefono ?? null, input.rol, config.policyVersion],
    );
    return publicUser(rows[0]);
  } catch (err) {
    if (err.code === '23505') throw conflict('Ya existe una cuenta con ese correo', 'CORREO_DUPLICADO');
    throw err;
  }
}

export async function login({ correo, contrasena }) {
  const { rows } = await query('SELECT * FROM usuario WHERE lower(correo) = lower($1)', [correo]);
  const user = rows[0];
  const ok = await bcrypt.compare(contrasena, user?.contrasena_hash ?? DUMMY_HASH);
  if (!user || !ok || user.estado === 'ELIMINADO') throw unauthorized('Correo o contraseña incorrectos', 'CREDENCIALES_INVALIDAS');
  if (user.estado === 'SUSPENDIDO') throw forbidden('Tu cuenta está suspendida. Contacta al administrador', 'CUENTA_SUSPENDIDA');
  return { token: signToken(user), token_type: 'Bearer', expira_en: config.jwt.expiresIn, usuario: publicUser(user) };
}
