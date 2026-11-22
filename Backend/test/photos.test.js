import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../src/config/env.js';
import { setupDb, startServer, registerUser, createCategory, pool } from './helpers.js';

let srv;
let api;
let host;
let otro;
let servicio;
before(async () => {
  await setupDb();
  srv = await startServer();
  api = srv.api;
  host = await registerUser(api, 'ANFITRION');
  otro = await registerUser(api, 'ANFITRION');
  const cat = await createCategory('Fotos');
  const r = await api('POST', '/api/services', {
    token: host.token,
    body: { tipo: 'ALOJAMIENTO', id_categoria: cat, titulo: 'Cabaña con fotos', descripcion: 'Hospedaje rural con senderos.', precio_base: 150000, capacidad_max: 4, localidad: 'Salento' },
  });
  servicio = r.body;
});
after(async () => { await srv.close(); await pool.end(); });

const png = (color = '#336699') => sharp({ create: { width: 40, height: 30, channels: 3, background: color } }).png().toBuffer();
const form = (buf, type = 'image/png', name = 'foto.png') => {
  const f = new FormData();
  f.append('foto', new Blob([buf], { type }), name);
  return f;
};
const archivo = (url) => path.join(config.uploads.dir, path.basename(new URL(url).pathname));

test('RF-09 sube fotos (se convierten a WebP), la primera queda como principal y se sirven con caché', async () => {
  const url = `/api/services/${servicio.id_servicio}/photos`;
  const a = await api('POST', url, { token: host.token, form: form(await png()) });
  assert.equal(a.status, 201, JSON.stringify(a.body));
  assert.equal(a.body.es_principal, true);
  assert.equal(a.body.orden, 1);
  assert.match(a.body.url, /^http:\/\/localhost:3000\/uploads\/[0-9a-f-]+\.webp$/);
  assert.ok(fs.existsSync(archivo(a.body.url)));
  assert.equal((await sharp(archivo(a.body.url)).metadata()).format, 'webp');
  const b = await api('POST', url, { token: host.token, form: form(await png('#aa3366')) });
  assert.equal(b.body.es_principal, false);
  assert.equal(b.body.orden, 2);

  const res = await fetch(`${srv.base}${new URL(a.body.url).pathname}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/webp');
  assert.match(res.headers.get('cache-control'), /immutable/);

  const detalle = await api('GET', `/api/services/${servicio.id_servicio}`);
  assert.equal(detalle.body.fotos.length, 2);
  assert.equal(detalle.body.fotos[0].id_foto, a.body.id_foto);
  const card = (await api('GET', '/api/services?q=fotos')).body.data[0];
  assert.equal(card.foto_principal, a.body.url);
});

test('RF-09 cambia la foto principal y el orden; al borrar la principal se promueve otra', async () => {
  const s = (await api('GET', `/api/services/${servicio.id_servicio}`)).body;
  const [f1, f2] = s.fotos;
  const mover = await api('PATCH', `/api/services/${servicio.id_servicio}/photos/${f2.id_foto}`, { token: host.token, body: { es_principal: true, orden: 1 } });
  assert.equal(mover.status, 200);
  assert.equal(mover.body.es_principal, true);
  const despues = (await api('GET', `/api/services/${servicio.id_servicio}`)).body.fotos;
  assert.equal(despues[0].id_foto, f2.id_foto);
  assert.equal(despues.filter((f) => f.es_principal).length, 1);
  assert.equal((await api('PATCH', `/api/services/${servicio.id_servicio}/photos/${f2.id_foto}`, { token: host.token, body: { es_principal: false } })).status, 400);

  const del = await api('DELETE', `/api/services/${servicio.id_servicio}/photos/${f2.id_foto}`, { token: host.token });
  assert.equal(del.status, 200);
  assert.ok(!fs.existsSync(archivo(f2.url)));
  const resto = (await api('GET', `/api/services/${servicio.id_servicio}`)).body.fotos;
  assert.equal(resto.length, 1);
  assert.equal(resto[0].id_foto, f1.id_foto);
  assert.equal(resto[0].es_principal, true);
  assert.equal((await api('DELETE', `/api/services/${servicio.id_servicio}/photos/${f2.id_foto}`, { token: host.token })).status, 404);
});

test('RF-09 rechaza archivos que no son imágenes, tipos no permitidos y archivos muy pesados', async () => {
  const url = `/api/services/${servicio.id_servicio}/photos`;
  const falsa = await api('POST', url, { token: host.token, form: form(Buffer.from('esto no es una imagen'), 'image/png') });
  assert.equal(falsa.status, 400);
  assert.equal(falsa.body.error.code, 'IMAGEN_INVALIDA');
  const texto = await api('POST', url, { token: host.token, form: form(Buffer.from('hola'), 'text/plain', 'a.txt') });
  assert.equal(texto.status, 400);
  assert.equal(texto.body.error.code, 'TIPO_DE_ARCHIVO_INVALIDO');
  const grande = await api('POST', url, { token: host.token, form: form(Buffer.alloc(6 * 1024 * 1024, 1), 'image/png') });
  assert.equal(grande.status, 413);
  const sin = await api('POST', url, { token: host.token, form: new FormData() });
  assert.equal(sin.status, 400);
  assert.equal(sin.body.error.code, 'FOTO_REQUERIDA');
});

test('RF-09 solo el propietario gestiona las fotos y hay un máximo por publicación', async () => {
  const url = `/api/services/${servicio.id_servicio}/photos`;
  assert.equal((await api('POST', url, { token: otro.token, form: form(await png()) })).status, 403);
  assert.equal((await api('POST', url, { form: form(await png()) })).status, 401);
  const { rows } = await pool.query('SELECT COUNT(*) AS n FROM foto_servicio WHERE id_servicio = $1', [servicio.id_servicio]);
  for (let i = rows[0].n; i < config.uploads.maxPerService; i += 1) {
    await pool.query("INSERT INTO foto_servicio (id_servicio, url, orden) VALUES ($1, '/uploads/relleno.webp', $2)", [servicio.id_servicio, i + 10]);
  }
  const r = await api('POST', url, { token: host.token, form: form(await png()) });
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'LIMITE_DE_FOTOS');
});
