import { readFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';
import { pool } from '../src/db/pool.js';

let counter = 0;
export const uniq = () => `${Date.now().toString(36)}${(counter += 1)}`;

// Prepara el esquema y deja la base de prueba vacía. Solo opera sobre bases cuyo nombre contenga "test".
export async function setupDb() {
  const dbName = new URL(config.databaseUrl).pathname.slice(1);
  if (!dbName.includes('test')) throw new Error(`Por seguridad las pruebas solo corren sobre una base con "test" en el nombre (actual: ${dbName})`);
  await pool.query(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  await resetDb();
}

export async function resetDb() {
  await pool.query('TRUNCATE denuncia, notificacion, calificacion, pago, reserva, disponibilidad, foto_servicio, servicio, categoria, usuario RESTART IDENTITY CASCADE');
}

export async function startServer() {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const api = async (method, path, { token, body, form } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload;
    if (form) payload = form;
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await fetch(`${base}${path}`, { method, headers, body: payload });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: res.status, body: json };
  };
  return { api, base, close: () => new Promise((resolve) => server.close(resolve)) };
}

export const PASSWORD = 'Clave12345';

export async function registerUser(api, rol = 'TURISTA', extra = {}) {
  const correo = `${rol.toLowerCase()}-${uniq()}@prueba.test`;
  const body = { nombre: `Usuario ${rol}`, correo, contrasena: PASSWORD, rol, acepta_politica: true, ...extra };
  const reg = await api('POST', '/api/auth/register', { body });
  if (reg.status !== 201) throw new Error(`registro falló: ${JSON.stringify(reg.body)}`);
  const login = await api('POST', '/api/auth/login', { body: { correo, contrasena: PASSWORD } });
  return { token: login.body.token, usuario: login.body.usuario, correo };
}

export async function createAdmin(api) {
  const correo = `admin-${uniq()}@prueba.test`;
  const hash = await bcrypt.hash(PASSWORD, 4);
  await pool.query(
    "INSERT INTO usuario (nombre, correo, contrasena_hash, rol, politica_version, politica_aceptada_en) VALUES ('Admin Prueba', $1, $2, 'ADMINISTRADOR', 'v1.0', now())",
    [correo, hash],
  );
  const login = await api('POST', '/api/auth/login', { body: { correo, contrasena: PASSWORD } });
  return { token: login.body.token, usuario: login.body.usuario, correo };
}

export async function createCategory(nombre = `Categoría ${uniq()}`) {
  const { rows } = await pool.query('INSERT INTO categoria (nombre) VALUES ($1) RETURNING id_categoria', [nombre]);
  return rows[0].id_categoria;
}

export { pool };
