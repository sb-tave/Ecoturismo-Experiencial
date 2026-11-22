# Trazabilidad: requisitos → implementación → pruebas

Cada requisito funcional del proyecto (RF-01 a RF-37) y los requisitos no funcionales que le competen al backend, con el lugar donde
se implementan y la prueba automática que los verifica (`npm test`).

## Requisitos funcionales

| RF | Requisito | Endpoint(s) | Código | Pruebas |
| --- | --- | --- | --- | --- |
| RF-01 | Registro de usuarios | `POST /api/auth/register` | `modules/auth` | `auth.test.js` |
| RF-02 | Aceptación de la política de datos | `GET /api/auth/policy`, campos de registro | `modules/auth` | `auth.test.js` |
| RF-03 | Inicio y cierre de sesión (JWT) | `POST /api/auth/login`, `/logout` | `modules/auth`, `middlewares/auth.js` | `auth.test.js`, `security.test.js` |
| RF-04 | Control de acceso por rol | todas las rutas protegidas | `middlewares/auth.js` | `services.test.js`, `security.test.js` |
| RF-05 | Gestión del perfil y eliminación de cuenta | `/api/users/me` | `modules/users` | `users.test.js`, `bookings.test.js` |
| RF-06 | Publicar alojamiento o actividad | `POST /api/services` | `modules/services` | `services.test.js` |
| RF-07 | Editar publicación propia | `PATCH /api/services/:id` | `modules/services` | `services.test.js` |
| RF-08 | Desactivar o eliminar publicación | `PATCH`/`DELETE /api/services/:id` | `services.remove` | `services.test.js`, `bookings.test.js` |
| RF-09 | Gestión de fotografías | `/api/services/:id/photos` | `photos.service.js`, `services/storage.js` | `photos.test.js` |
| RF-10 | Perfil de negocio local | `POST /api/services` (`NEGOCIO_LOCAL`) | `modules/services` | `services.test.js` |
| RF-11 | Gestión de categorías | `/api/categories` | `modules/categories` | `services.test.js` |
| RF-12 | Búsqueda por destino o palabra clave | `GET /api/services?q=` | `services.search` | `services.test.js` |
| RF-13 | Filtros dinámicos | `GET /api/services?...` | `services.search` | `services.test.js` |
| RF-14 | Resultados en lista y mapa | coordenadas en cada resultado (el mapa lo dibuja el frontend) | `services.search` | `services.test.js` |
| RF-15 | Búsqueda por cercanía | `GET /api/services?lat&lng&radio_km` | `services.search` (Haversine) | `services.test.js` |
| RF-16 | Detalle del servicio | `GET /api/services/:id`, `/availability`, `/reviews` | `modules/services`, `modules/reviews` | `services.test.js`, `reviews.test.js` |
| RF-17 | Gestión de disponibilidad | `PUT /availability`, `POST /availability/block` | `availability.service.js` | `services.test.js` |
| RF-18 | Calendario de disponibilidad | `GET /api/services/:id/availability` | `availability.service.js` | `services.test.js` |
| RF-19 | Crear reserva con comprobante | `POST /api/bookings` | `bookings.service.create` | `bookings.test.js` |
| RF-20 | Control de reservas simultáneas | `POST /api/bookings` | bloqueo de filas ordenado + `CHECK` | `bookings.test.js` (2 pruebas de concurrencia) |
| RF-21 | Ciclo de vida de la reserva | estados de `reserva` | `bookings`, `payments`, `jobs/reservations.js` | `jobs.test.js`, `payments.test.js` |
| RF-22 | Expiración de reservas sin pago | tarea programada; `POST /api/payments/simulate` | `jobs/reservations.js` | `jobs.test.js`, `payments.test.js` |
| RF-23 | Consulta de mis reservas | `GET /api/bookings`, `/:id` | `bookings.service.list` | `bookings.test.js` |
| RF-24 | Cancelación de reserva propia | `PATCH /api/bookings/:id/cancel` | `bookings.service.cancel` | `bookings.test.js` |
| RF-25 | Panel de reservas recibidas | `GET /api/bookings` (rol anfitrión) | `bookings.service.list` | `bookings.test.js` |
| RF-26 | Pago simulado | `POST /api/payments/simulate` | `payments.service.js`, `services/paymentGateway.js` | `payments.test.js` |
| RF-27 | Registro del pago y actualización de la reserva | `POST /api/payments/simulate`, `GET /api/payments` | `payments.service.js` | `payments.test.js` |
| RF-28 | Notificaciones (correo y plataforma) | `/api/notifications` | `notifications.service.js`, `services/mailer.js` | `payments.test.js`, `bookings.test.js` |
| RF-29 | Calificar un servicio | `POST /api/services/:id/reviews` | `reviews.service.create` | `reviews.test.js` |
| RF-30 | Promedio y listado de reseñas | `GET /api/services/:id/reviews` | `reviews.service` | `reviews.test.js` |
| RF-31 | Gestión de usuarios | `/api/admin/users` | `modules/admin` | `moderation.test.js` |
| RF-32 | Moderación de publicaciones | `/api/admin/services` | `modules/admin` | `moderation.test.js` |
| RF-33 | Moderación de reseñas | `/api/admin/reviews` | `modules/admin` | `moderation.test.js` |
| RF-34 | Denuncia de contenido | `POST /api/complaints` | `modules/complaints` | `moderation.test.js` |
| RF-35 | Gestión de denuncias | `/api/admin/complaints` | `modules/complaints` | `moderation.test.js` |
| RF-36 | Gestión de reservas (administrador) | `GET /api/bookings`, `PATCH /:id/cancel` | `modules/bookings` | `bookings.test.js` |
| RF-37 | Reportes de reservas e ingresos | `GET /api/admin/reports/summary` | `admin.service.summary` | `reports.test.js` |

## Requisitos no funcionales

| RNF | Cómo se cubre en el backend | Verificación |
| --- | --- | --- |
| RNF-01 HTTPS | Redirección 308 y HSTS (`middlewares/httpsRedirect.js`, `helmet`) | `security.test.js` |
| RNF-02 Credenciales | Hash bcrypt, secreto JWT obligatorio en producción | `auth.test.js` |
| RNF-03 Control de acceso por rol | `requireRole` y verificación de propiedad en cada servicio | `services.test.js`, `bookings.test.js`, `security.test.js` |
| RNF-04 OWASP Top 10 | Consultas parametrizadas, validación con zod, cabeceras, CORS, límites, validación de imágenes | `security.test.js`, `photos.test.js` |
| RNF-05 Seguridad en pagos | Pasarela simulada; `pago` solo guarda monto, medio y referencia | `payments.test.js` |
| RNF-06 Ley 1581 · aceptación | `politica_version` y `politica_aceptada_en` | `auth.test.js` |
| RNF-07 Derechos del titular | `GET/PATCH/DELETE /api/users/me` (anonimización) | `users.test.js`, `bookings.test.js` |
| RNF-08 Ubicación con permiso | `lat`/`lng` solo por parámetro explícito; no se guardan ni se registran | `services.test.js` |
| RNF-09 Datos en logs | `pino` con redacción y query string fuera de los logs | `utils/logger.js`, `app.js` |
| RNF-10 Escalamiento horizontal | JWT sin estado, tareas con `SKIP LOCKED` | `jobs.test.js` |
| RNF-11 Concurrencia en reservas | Bloqueo pesimista por fecha y `CHECK` de cupos | `bookings.test.js` |
| RNF-12 Índices e imágenes | Índices de búsqueda y geográficos, WebP y caché inmutable | `db/schema.sql`, `photos.test.js` |
| RNF-15 / RNF-16 / RNF-17 | `/health`, cierre ordenado; correos que no bloquean el flujo; las copias de seguridad dependen de la infraestructura | `health.test.js` |
| RNF-21 Imágenes WebP | Conversión a WebP al subir | `photos.test.js` |
| RNF-22 a RNF-25 Rendimiento | Índices y consultas únicas; `npm run load-test` y `scripts/load-test.k6.js` | `scripts/load-test.js` |

Los requisitos de interfaz (RNF-18 a RNF-21 en la parte visual) corresponden al frontend.
