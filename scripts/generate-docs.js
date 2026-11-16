// Genera docs/API.md y la colección de Postman a partir de scripts/endpoints.js  ->  npm run docs
import { writeFileSync, mkdirSync } from 'node:fs';
import { carpetas } from './endpoints.js';

mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
const salida = (n) => new URL(`../docs/${n}`, import.meta.url);

const numeric = (obj) => JSON.stringify(obj, null, 2).replace(/"#(\w+)"/g, '{{$1}}');

const defaultStatus = (e) => (/\/auth\/(login|logout)|\/availability\/block/.test(e.r) ? 200 : e.m === 'POST' ? 201 : 200);

function item(e) {
  const [ruta, qs] = e.r.split('?');
  const url = {
    raw: `{{baseUrl}}${e.r}`,
    host: ['{{baseUrl}}'],
    path: ruta.split('/').filter(Boolean),
    ...(qs ? { query: qs.split('&').map((p) => { const [key, ...v] = p.split('='); return { key, value: v.join('=') }; }) } : {}),
  };
  const request = {
    method: e.m,
    header: e.body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
    url,
    description: `${e.d}${e.rf ? `\n\nRequisito(s): ${e.rf}` : ''}\nQuién puede usarlo: ${e.rol}`,
    auth: e.as ? { type: 'bearer', bearer: [{ key: 'token', value: `{{${e.as}}}`, type: 'string' }] } : { type: 'noauth' },
  };
  if (e.body) request.body = { mode: 'raw', raw: numeric(e.body), options: { raw: { language: 'json' } } };
  if (e.archivo) request.body = { mode: 'formdata', formdata: [{ key: e.archivo, type: 'file', src: [] }] };
  const event = [];
  if (e.pre) event.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: [e.pre] } });
  // Cada petición verifica su código de respuesta esperado, así la colección sirve también como prueba (newman)
  const esperado = e.ok ?? [defaultStatus(e)];
  const exec = [`pm.test('Responde ${esperado.join(' o ')}', () => pm.expect(${JSON.stringify(esperado)}).to.include(pm.response.code));`];
  if (e.test) exec.push('if (pm.response.code < 300) {', ...e.test.map((l) => `  ${l}`), '}');
  event.push({ listen: 'test', script: { type: 'text/javascript', exec } });
  return { name: e.n, ...(event.length ? { event } : {}), request };
}

const coleccion = {
  info: {
    name: 'Eco Turismo Experiencial · API',
    description: 'Colección de pruebas del backend. Ejecute las carpetas en orden: el inicio de sesión guarda los tokens y las creaciones guardan los ids en variables de la colección.\nRequiere npm run seed (administrador) y el servidor en marcha.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3000' },
    { key: 'adminCorreo', value: 'admin@ecoturismo.local' },
    { key: 'adminContrasena', value: 'Admin12345' },
    ...['tokenTurista', 'tokenAnfitrion', 'tokenNegocio', 'tokenAdmin', 'idCategoria', 'idServicio', 'idReserva', 'idReservaCompletada'].map((key) => ({ key, value: '' })),
  ],
  event: [{
    listen: 'prerequest',
    script: { type: 'text/javascript', exec: [
      'const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);',
      "pm.collectionVariables.set('hoy', d(0)); pm.collectionVariables.set('desde', d(1)); pm.collectionVariables.set('hasta', d(30));",
      "pm.collectionVariables.set('inicio', d(3)); pm.collectionVariables.set('fin', d(5));",
    ] },
  }],
  item: carpetas.map((c) => ({ name: c.nombre, item: c.endpoints.map(item) })),
};
writeFileSync(salida('ecoturismo.postman_collection.json'), `${JSON.stringify(coleccion, null, 2)}\n`);

const filas = carpetas.map((c) => {
  const tabla = c.endpoints.map((e) => `| \`${e.m}\` | \`${e.r.split('?')[0]}\` | ${e.rol} | ${e.rf || '—'} | ${e.d} |`).join('\n');
  return `### ${c.nombre.replace(/^\d+\.\s*/, '')}\n\n| Método | Ruta | Quién | Requisito | Descripción |\n| --- | --- | --- | --- | --- |\n${tabla}\n`;
}).join('\n');
const total = carpetas.reduce((n, c) => n + c.endpoints.length, 0);

writeFileSync(salida('API.md'), `# Referencia de la API

Generado con \`npm run docs\` a partir de \`scripts/endpoints.js\` (${total} endpoints). Para probarlos use la colección
\`docs/ecoturismo.postman_collection.json\` (Postman → Import).

## Convenciones

- **Base:** \`http://localhost:3000\`. Todas las rutas de negocio cuelgan de \`/api\`. Formato JSON (UTF-8).
- **Autenticación:** \`Authorization: Bearer <token>\` (JWT HS256 obtenido en \`POST /api/auth/login\`). Sin token: 401. Token de otro rol: 403.
- **Roles:** TURISTA, ANFITRION, NEGOCIO_LOCAL y ADMINISTRADOR. El rol se consulta siempre en la base de datos, no se toma del token.
- **Campos:** nombres en español y \`snake_case\`, iguales a las columnas del modelo entidad-relación (\`id_servicio\`, \`fecha_inicio\`…).
  Las fechas viajan como \`AAAA-MM-DD\` y las marcas de tiempo en ISO 8601. Los precios están en pesos colombianos (COP).
- **Paginación:** \`?page=1&limit=20\` (máximo 50). Respuesta: \`{ "data": [...], "meta": { "page", "limit", "total", "total_pages" } }\`.
- **Errores:** siempre \`{ "error": { "code": "SIN_DISPONIBILIDAD", "message": "…", "details": [...] } }\`.

| Estado | Cuándo |
| --- | --- |
| 400 | Datos inválidos (\`code: VALIDACION\`, con \`details\` por campo) o regla de negocio no cumplida |
| 401 / 403 | Sin sesión o token inválido / sin permiso o cuenta suspendida |
| 404 | No existe o no pertenece al usuario |
| 409 | Conflicto: correo repetido, sin disponibilidad, reserva no cancelable, etc. |
| 413 / 429 | Cuerpo o imagen demasiado grande / demasiadas solicitudes |

## Endpoints

${filas}
## Reglas de negocio que conviene conocer

- **Cupos:** un alojamiento consume 1 cupo por *noche* (el día de salida no cuenta); una actividad consume 1 cupo por *persona* en cada día.
- **Precio:** alojamiento = \`precio_base × noches\`; actividad = \`precio_base × personas × días\`. Siempre lo calcula el backend.
- **Estados de la reserva:** \`PENDIENTE_PAGO → CONFIRMADA → COMPLETADA\` y \`CANCELADA\`. Una reserva sin pago vence a los 15 minutos
  (\`RESERVATION_HOLD_MINUTES\`) y libera el cupo; al terminar la fecha de la estadía pasa a \`COMPLETADA\`.
- **Concurrencia:** las reservas simultáneas por el último cupo se serializan con bloqueo de filas ordenado por fecha; solo una se acepta (409 \`SIN_DISPONIBILIDAD\` para las demás).
- **Calificaciones:** solo con reserva \`COMPLETADA\` y pagada, una por reserva. Las reseñas públicas muestran el nombre abreviado.
- **Moderación:** un contenido oculto no aparece en el catálogo ni puede ser reactivado por su propietario.

## Ejemplo de flujo con curl

\`\`\`bash
# 1. Registro e inicio de sesión
curl -X POST localhost:3000/api/auth/register -H 'Content-Type: application/json' \\
  -d '{"nombre":"Camila Rojas","correo":"camila@correo.co","contrasena":"Clave12345","rol":"TURISTA","acepta_politica":true}'
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \\
  -d '{"correo":"camila@correo.co","contrasena":"Clave12345"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

# 2. Buscar alojamientos disponibles
curl "localhost:3000/api/services?tipo=ALOJAMIENTO&localidad=Salento&fecha_inicio=2026-12-10&fecha_fin=2026-12-12&personas=2"

# 3. Reservar y pagar (pasarela simulada)
curl -X POST localhost:3000/api/bookings -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \\
  -d '{"id_servicio":1,"fecha_inicio":"2026-12-10","fecha_fin":"2026-12-12","num_personas":2}'
curl -X POST localhost:3000/api/payments/simulate -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \\
  -d '{"id_reserva":1,"metodo":"TARJETA_SIMULADA","resultado":"APROBADO"}'
\`\`\`
`);
console.log(`Documentación generada: ${total} endpoints`);
