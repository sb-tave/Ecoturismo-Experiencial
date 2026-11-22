# Eco Turismo Experiencial · Backend

API REST del marketplace de ecoturismo: publicación, búsqueda y reserva de alojamientos rurales, actividades de naturaleza y
negocios locales, con pagos simulados, calificaciones, moderación y reportes. Implementa los requisitos funcionales
(RF-01 a RF-37) y la arquitectura definida en el proyecto de Ingeniería de Software I.

**En números:** 57 endpoints · 10 tablas · 74 pruebas automáticas (incluye concurrencia y seguridad) · 0 vulnerabilidades en `npm audit`.

## Stack

| Componente | Tecnología | Por qué |
| --- | --- | --- |
| Servidor | Node.js 20.10+ (probado en 22) y Express 4 | Definido en las especificaciones técnicas del proyecto |
| Base de datos | PostgreSQL 14+ | Integridad transaccional para reservas y pagos, bloqueos de fila y restricciones `CHECK` (RNF-11) |
| API | REST con JSON y autenticación JWT (HS256) | RNF-10: sin estado en el servidor, escalable horizontalmente |
| Seguridad | `bcryptjs`, `helmet`, `cors`, `express-rate-limit`, `zod` | RNF-02, RNF-04 (OWASP Top 10) |
| Imágenes | `multer` + `sharp` (conversión a WebP) | RF-09, RNF-21 |
| Correo | `nodemailer` (SMTP opcional; sin SMTP queda en el log) | RF-28 |
| Logs | `pino` con datos sensibles enmascarados | RNF-09 |
| Pruebas | `node:test` (sin dependencias extra), Postman/newman, autocannon y k6 | RNF-04, RNF-25 |

El mapa (Leaflet/OpenStreetMap) lo dibuja el frontend: el backend entrega `latitud` y `longitud` y busca por cercanía.
La pasarela de pagos es **simulada**, como pide el enunciado (`src/services/paymentGateway.js`).

## Inicio rápido

### Opción A · Docker (todo en un comando)

```bash
docker compose up --build
```

Levanta PostgreSQL y la API en `http://localhost:3000`, aplica el esquema y crea el administrador y las categorías.
Para cargar además datos de demostración: `docker compose exec api node scripts/seed.js --demo --force`.

### Opción B · Local

Requisitos: Node.js 20.10 o superior y PostgreSQL 14 o superior.

```bash
git clone <URL-del-repositorio> && cd ecoturismo-backend
npm install
cp .env.example .env          # en Windows: copy .env.example .env  (y edite JWT_SECRET)
createdb ecoturismo           # y createdb ecoturismo_test para las pruebas
npm run db:migrate            # crea las tablas
npm run seed:demo             # categorías, administrador y datos de demostración
npm run dev                   # http://localhost:3000  (npm start en producción)
```

Compruebe que todo funciona con `curl localhost:3000/health` o ejecute el recorrido completo con `npm run smoke`.

**Cuentas de demostración** (`npm run seed:demo`): `turista@demo.test`, `anfitrion@demo.test` y `negocio@demo.test`
(contraseña `Demo12345`) y el administrador `admin@ecoturismo.local` (contraseña `ADMIN_PASSWORD` del `.env`).

## Variables de entorno

Todas están documentadas en [`.env.example`](.env.example). Las más importantes:

| Variable | Qué hace | Por defecto |
| --- | --- | --- |
| `DATABASE_URL` / `TEST_DATABASE_URL` | Conexión a PostgreSQL (desarrollo / pruebas; la de pruebas debe contener «test») | local |
| `JWT_SECRET` | Firma de los tokens. **Obligatoria en producción (mínimo 32 caracteres)** | solo desarrollo |
| `CORS_ORIGINS` | Orígenes del frontend permitidos | `localhost:5173`, `localhost:8080` |
| `FORCE_HTTPS` / `TRUST_PROXY` | Redirige HTTP a HTTPS (RNF-01) detrás de un proxy | `true` en producción |
| `RESERVATION_HOLD_MINUTES` | Minutos para pagar una reserva antes de que venza (RF-22) | 15 |
| `PAYMENT_ALLOW_FORCED_RESULT` | Permite elegir `APROBADO` o `RECHAZADO` en el pago simulado (demostraciones) | `true` fuera de producción |
| `SMTP_HOST`, `SMTP_*` | Envío real de correos (si se omite, solo se registra en el log) | vacío |
| `UPLOAD_DIR`, `PUBLIC_BASE_URL` | Carpeta de imágenes y URL pública para construir enlaces absolutos | `uploads`, `localhost:3000` |

## Scripts

| Comando | Para qué sirve |
| --- | --- |
| `npm run dev` / `npm start` | Servidor con recarga automática / servidor normal |
| `npm run db:migrate` | Aplica `db/schema.sql` (idempotente) |
| `npm run seed` / `npm run seed:demo` | Categorías y administrador / además datos de demostración |
| `npm test` | 74 pruebas automáticas sobre la base `ecoturismo_test` |
| `npm run smoke` | Recorrido de punta a punta contra un servidor en marcha (buscar, reservar, pagar, notificar, reportar) |
| `npm run load-test` | Prueba de carga ligera con autocannon (RNF-24) |
| `npm run docs` | Regenera `docs/API.md` y la colección de Postman desde `scripts/endpoints.js` |

## Estructura del proyecto

```
├── db/schema.sql               Esquema PostgreSQL (10 tablas, restricciones e índices)
├── src/
│   ├── app.js · server.js      Aplicación Express y arranque (cierre ordenado, tareas programadas)
│   ├── config/                 Variables de entorno validadas
│   ├── db/pool.js              Pool de conexiones y transacciones con reintento ante deadlocks
│   ├── middlewares/            auth (JWT y roles), validación, errores, límites, HTTPS, carga de imágenes
│   ├── modules/                Un módulo por área: auth, users, categories, services (+disponibilidad y fotos),
│   │                           bookings, payments, notifications, reviews, complaints, admin
│   ├── services/               Correo, almacenamiento de imágenes y pasarela de pagos simulada
│   ├── jobs/reservations.js    Expiración de reservas sin pago y paso a «completada»
│   └── utils/                  Errores, fechas, esquemas comunes, logger
├── test/                       12 archivos de pruebas de integración (HTTP + PostgreSQL real)
├── scripts/                    migrate, seed, smoke, load-test (autocannon y k6), generador de documentación
├── docs/                       API.md, TRAZABILIDAD.md y colección de Postman
├── Dockerfile · docker-compose.yml · .github/workflows/ci.yml
```

Cada módulo separa las rutas (validación y permisos) del servicio (reglas de negocio y SQL).

## Modelo de datos

Implementa el modelo entidad-relación del proyecto: `usuario`, `categoria`, `servicio`, `foto_servicio`, `disponibilidad`,
`reserva`, `pago`, `calificacion`, `notificacion` y `denuncia` (ver [`db/schema.sql`](db/schema.sql)). Los campos de la API usan
los mismos nombres que las columnas. Diferencias menores respecto al diagrama del documento:

- Las marcas de tiempo son `TIMESTAMPTZ` (con zona horaria) en lugar de `TIMESTAMP`.
- `usuario.estado` admite también `ELIMINADO` y existe `eliminado_en`: eliminar la cuenta anonimiza los datos personales y conserva las reservas para los reportes (RNF-07).
- Los nombres de tablas van en minúscula (`foto_servicio`) y el correo es único sin distinguir mayúsculas.
- Índices parciales únicos: una sola foto principal por servicio y una sola denuncia pendiente por usuario y contenido.

## Reglas de negocio clave

- **Cupos y precios.** Un alojamiento consume 1 cupo por noche (el día de salida no cuenta) y cobra `precio_base × noches`; una actividad consume 1 cupo por persona y por día y cobra `precio_base × personas × días`. El precio lo calcula siempre el backend.
- **Concurrencia (RF-20).** Al reservar se bloquean las filas de disponibilidad en orden de fecha (`SELECT … FOR UPDATE`) y la restricción `CHECK (cupos_disponibles >= 0)` impide la sobreventa. Con 8 turistas reservando a la vez el último cupo, exactamente una reserva se acepta.
- **Ciclo de vida de la reserva.** `PENDIENTE_PAGO → CONFIRMADA → COMPLETADA`, o `CANCELADA`. Sin pago, vence a los 15 minutos y libera el cupo (tarea programada segura para varias instancias). Al terminar la estadía pasa a `COMPLETADA`.
- **Pagos simulados.** El cliente solo envía la reserva y el medio; el monto sale de la reserva. Un pago rechazado no confirma y se puede reintentar. Al aprobarse se notifica al turista (resumen por correo) y al anfitrión.
- **Calificaciones.** Solo con reserva completada y pagada, una por reserva. El promedio se recalcula al crear, ocultar, restaurar o eliminar reseñas.
- **Publicaciones.** Un servicio con reservas no se borra: el propietario lo desactiva y el administrador lo oculta. Lo oculto por moderación no lo puede reactivar su propietario.

## API

Referencia completa con los 57 endpoints, roles y requisitos: [`docs/API.md`](docs/API.md).
Colección lista para Postman: [`docs/ecoturismo.postman_collection.json`](docs/ecoturismo.postman_collection.json)
(Import → ejecute las carpetas en orden; guarda los tokens y los ids solos).

Para integrar el frontend (Vue u otro): enviar `Authorization: Bearer <token>`, agregar su origen en `CORS_ORIGINS`, y usar las URLs
absolutas de imágenes que devuelve la API (`PUBLIC_BASE_URL`). Todos los errores tienen la forma `{ "error": { "code", "message", "details?" } }`.

## Seguridad

Cobertura de los requisitos no funcionales (detalle y pruebas en [`docs/TRAZABILIDAD.md`](docs/TRAZABILIDAD.md)):

| Requisito | Implementación |
| --- | --- |
| RNF-01 HTTPS | Redirección 308 de HTTP a HTTPS (`FORCE_HTTPS`) y HSTS; el TLS lo termina el proxy o balanceador |
| RNF-02 Credenciales | Contraseñas con hash bcrypt (12 rondas); `JWT_SECRET` obligatorio en producción. El cifrado en reposo se configura en la base de datos o el disco |
| RNF-03 Roles | `requireRole` en cada ruta y verificación de propiedad; el rol se lee de la base, no del token |
| RNF-04 OWASP | SQL parametrizado, validación de toda entrada (zod), `helmet`, CORS por lista blanca, límite de intentos y de tamaño, JWT con algoritmo fijado, validación real de imágenes, errores sin detalles internos |
| RNF-05 Pagos | Pasarela simulada; solo se guardan monto, medio y referencia, nunca datos de tarjeta |
| RNF-06 / RNF-07 Datos personales | Versión y fecha de aceptación de la política; el titular consulta, actualiza y elimina (anonimiza) su cuenta |
| RNF-08 / RNF-09 | La ubicación solo viaja si el cliente la envía y no se registra (los logs no incluyen la query string); logs con credenciales enmascaradas |
| RNF-10 / RNF-15 | Backend sin estado, tareas idempotentes, `/health` y `/health/ready`, cierre ordenado |

## Pruebas

```bash
createdb ecoturismo_test      # una sola vez (con Docker Compose ya se crea)
npm test                      # 74 pruebas, unos 15 segundos
```

Son pruebas de integración: levantan la API real y consultan PostgreSQL real (nunca simulado). Cubren cada requisito funcional,
roles y permisos, las reservas simultáneas, la expiración de reservas, los pagos, la moderación y la seguridad (inyección SQL,
tokens manipulados, CORS, límite de intentos, redirección a HTTPS). Por seguridad solo corren sobre una base cuyo nombre contenga «test».

Otras verificaciones:

- `npm run smoke` · recorrido completo contra un servidor en marcha.
- Colección de Postman ejecutada con newman: 57 solicitudes y 57 verificaciones sin fallos.
- `npm run load-test` (autocannon) o `k6 run scripts/load-test.k6.js` (RNF-25). Referencia en una máquina de 1 vCPU compartida con la base de datos y el generador de carga: unas 470 solicitudes por segundo con 50 conexiones y latencia p97.5 de 196 ms, por debajo del objetivo de 1 s del RNF-24.

## Despliegue en producción

1. `NODE_ENV=production`, un `JWT_SECRET` largo y aleatorio, `ADMIN_PASSWORD` propia, `CORS_ORIGINS` con el dominio real.
2. Publicar detrás de un proxy o balanceador con TLS y dejar `TRUST_PROXY=true` y `FORCE_HTTPS=true`.
3. PostgreSQL administrado con copias de seguridad diarias (RNF-16) y `DB_SSL=true` si el proveedor lo exige.
4. Al escalar a varias instancias, mover las imágenes a un almacenamiento de objetos con CDN (solo hay que cambiar `src/services/storage.js`) o compartir el volumen `uploads`.
5. Configurar `SMTP_*` para enviar correos reales y desactivar `PAYMENT_ALLOW_FORCED_RESULT`.

## Flujo de trabajo con Git

Ramas: `main` (estable), `develop` (integración) y `feature/<tema>` por historia de usuario. Commits breves al estilo
`feat(reservas): …`, `fix(pagos): …`, `test: …`, `docs: …`. La integración continua (`.github/workflows/ci.yml`) ejecuta las pruebas
contra PostgreSQL y audita las dependencias en cada push y pull request.

Para publicar este repositorio en GitHub, GitLab u otro:

```bash
git remote add origin <URL-del-repositorio-vacío>
git push -u origin main
```

## Alcance y trabajo futuro

Fuera de la primera versión (según el alcance técnico del proyecto): suscripción premium para anfitriones, publicidad de negocios
locales, paquetes turísticos y reembolsos (cancelar una reserva confirmada libera el cupo pero no simula una devolución). Para
producción real faltaría una pasarela de pagos verdadera, almacenamiento de objetos con CDN, un sistema de migraciones
(por ejemplo `node-pg-migrate`) y búsqueda de texto con `pg_trgm` o texto completo si el catálogo crece mucho.
