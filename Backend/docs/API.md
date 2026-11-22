# Referencia de la API

Generado con `npm run docs` a partir de `scripts/endpoints.js` (57 endpoints). Para probarlos use la colección
`docs/ecoturismo.postman_collection.json` (Postman → Import).

## Convenciones

- **Base:** `http://localhost:3000`. Todas las rutas de negocio cuelgan de `/api`. Formato JSON (UTF-8).
- **Autenticación:** `Authorization: Bearer <token>` (JWT HS256 obtenido en `POST /api/auth/login`). Sin token: 401. Token de otro rol: 403.
- **Roles:** TURISTA, ANFITRION, NEGOCIO_LOCAL y ADMINISTRADOR. El rol se consulta siempre en la base de datos, no se toma del token.
- **Campos:** nombres en español y `snake_case`, iguales a las columnas del modelo entidad-relación (`id_servicio`, `fecha_inicio`…).
  Las fechas viajan como `AAAA-MM-DD` y las marcas de tiempo en ISO 8601. Los precios están en pesos colombianos (COP).
- **Paginación:** `?page=1&limit=20` (máximo 50). Respuesta: `{ "data": [...], "meta": { "page", "limit", "total", "total_pages" } }`.
- **Errores:** siempre `{ "error": { "code": "SIN_DISPONIBILIDAD", "message": "…", "details": [...] } }`.

| Estado | Cuándo |
| --- | --- |
| 400 | Datos inválidos (`code: VALIDACION`, con `details` por campo) o regla de negocio no cumplida |
| 401 / 403 | Sin sesión o token inválido / sin permiso o cuenta suspendida |
| 404 | No existe o no pertenece al usuario |
| 409 | Conflicto: correo repetido, sin disponibilidad, reserva no cancelable, etc. |
| 413 / 429 | Cuerpo o imagen demasiado grande / demasiadas solicitudes |

## Endpoints

### Salud

| Método | Ruta | Quién | Requisito | Descripción |
| --- | --- | --- | --- | --- |
| `GET` | `/health` | Público | — | Comprueba que el servidor responde. |
| `GET` | `/health/ready` | Público | — | Comprueba la conexión con PostgreSQL (503 si no hay). |

### Autenticación

| Método | Ruta | Quién | Requisito | Descripción |
| --- | --- | --- | --- | --- |
| `GET` | `/api/auth/policy` | Público | RF-02 | Devuelve la versión de la política que se debe aceptar al registrarse. |
| `POST` | `/api/auth/register` | Público | RF-01, RF-02 | Crea una cuenta (TURISTA, ANFITRION o NEGOCIO_LOCAL). Exige acepta_politica=true. Nunca crea administradores. |
| `POST` | `/api/auth/register` | Público | RF-01 | Igual que el anterior con rol ANFITRION. |
| `POST` | `/api/auth/login` | Público | RF-03 | Devuelve un token JWT (Bearer). Los errores de credenciales son genéricos. |
| `POST` | `/api/auth/login` | Público | RF-03 | Inicio de sesión del anfitrión. |
| `POST` | `/api/auth/login` | Público | RF-03 | Usa la cuenta creada con npm run seed (variables adminCorreo y adminContrasena). |
| `POST` | `/api/auth/logout` | Autenticado | RF-03 | El cliente descarta el token (JWT sin estado, RNF-10). |

### Perfil

| Método | Ruta | Quién | Requisito | Descripción |
| --- | --- | --- | --- | --- |
| `GET` | `/api/users/me` | Autenticado | RF-05, RNF-07 | Consulta los datos personales del titular. |
| `PATCH` | `/api/users/me` | Autenticado | RF-05 | Actualiza nombre y teléfono. |
| `PATCH` | `/api/users/me/password` | Autenticado | RF-05 | Exige la contraseña actual. |

### Categorías

| Método | Ruta | Quién | Requisito | Descripción |
| --- | --- | --- | --- | --- |
| `GET` | `/api/categories` | Público | RF-11 | Categorías activas. El administrador puede usar ?todas=true. |
| `POST` | `/api/categories` | Administrador | RF-11 | Crea una categoría. |
| `PATCH` | `/api/categories/{{idCategoriaNueva}}` | Administrador | RF-11 | Cambia nombre, descripción o activa. |
| `DELETE` | `/api/categories/{{idCategoriaNueva}}` | Administrador | RF-11 | Si tiene servicios solo se desactiva. |

### Servicios

| Método | Ruta | Quién | Requisito | Descripción |
| --- | --- | --- | --- | --- |
| `POST` | `/api/services` | Anfitrión | RF-06 | Publica un alojamiento (queda ACTIVO y visible al guardarlo). |
| `POST` | `/api/services` | Anfitrión | RF-06 | Publica una actividad (precio por persona). |
| `GET` | `/api/services` | Público | RF-12, RF-13 | Filtros: q, tipo, id_categoria, localidad, precio_min/max, calificacion_min, personas, fecha_inicio+fecha_fin, orden y paginación. |
| `GET` | `/api/services` | Público | RF-13 | Solo servicios con cupos en todas las fechas pedidas. |
| `GET` | `/api/services` | Público | RF-15 | Ordena por distancia (distancia_km) dentro del radio. |
| `GET` | `/api/services/{{idServicio}}` | Público | RF-16 | Datos, fotos, promedio y anfitrión. Los inactivos solo los ve su propietario o el administrador. |
| `GET` | `/api/services/mine` | Anfitrión, Negocio local | RF-06 | Lista las publicaciones propias en cualquier estado. |
| `PATCH` | `/api/services/{{idServicio}}` | Propietario | RF-07, RF-08 | Edita campos o cambia estado (ACTIVO/INACTIVO). No cambia el tipo. |
| `DELETE` | `/api/services/{{idActividad}}` | Propietario | RF-08 | Sin reservas se elimina; con reservas solo se desactiva. |
| `PUT` | `/api/services/{{idServicio}}/availability` | Anfitrión propietario | RF-17 | Cupos por día para un periodo (máx. 366 días). No baja de lo ya reservado. |
| `GET` | `/api/services/{{idServicio}}/availability` | Público | RF-18 | Cupos por día; los días sin registro no están disponibles. |
| `POST` | `/api/services/{{idServicio}}/availability/block` | Anfitrión propietario | RF-17 | Bloquea los días sin reservas e informa los que tienen reservas. |
| `POST` | `/api/services/{{idServicio}}/photos` | Propietario | RF-09 | multipart/form-data, campo «foto» (JPG, PNG o WebP, máx. 5 MB). Se convierte a WebP. |
| `PATCH` | `/api/services/{{idServicio}}/photos/{{idFoto}}` | Propietario | RF-09 | Marca la foto principal o cambia su orden. |
| `DELETE` | `/api/services/{{idServicio}}/photos/{{idFoto}}` | Propietario | RF-09 | Elimina la foto y su archivo. |

### Reservas

| Método | Ruta | Quién | Requisito | Descripción |
| --- | --- | --- | --- | --- |
| `POST` | `/api/bookings` | Turista | RF-19, RF-20 | Reserva pendiente de pago; descuenta cupos de forma atómica y devuelve el comprobante. |
| `GET` | `/api/bookings` | Turista, Anfitrión, Administrador | RF-23, RF-25, RF-36 | El turista ve las suyas, el anfitrión las de sus servicios y el administrador todas. |
| `GET` | `/api/bookings/{{idReserva}}` | Turista dueño, Anfitrión propietario, Administrador | RF-23 | Incluye los intentos de pago. |

### Pagos simulados y cancelación

| Método | Ruta | Quién | Requisito | Descripción |
| --- | --- | --- | --- | --- |
| `POST` | `/api/payments/simulate` | Turista | RF-27 | Simula un rechazo: la reserva sigue pendiente y se puede reintentar. |
| `POST` | `/api/payments/simulate` | Turista | RF-26, RF-27 | Pasarela simulada. El monto lo calcula el backend; no se envían datos de tarjeta. |
| `GET` | `/api/payments` | Turista, Anfitrión propietario, Administrador | RF-27 | Lista los intentos de pago. |
| `PATCH` | `/api/bookings/{{idReserva}}/cancel` | Turista, Administrador | RF-24, RF-36 | Libera los cupos. No aplica a reservas completadas. |

### Calificaciones y notificaciones

| Método | Ruta | Quién | Requisito | Descripción |
| --- | --- | --- | --- | --- |
| `GET` | `/api/services/{{idServicio}}/reviews` | Público | RF-16, RF-30 | Reseñas visibles, promedio y distribución por estrellas. |
| `POST` | `/api/services/{{idServicio}}/reviews` | Turista | RF-29 | Solo con una reserva COMPLETADA y pagada (una reseña por reserva). |
| `GET` | `/api/notifications` | Autenticado | RF-28 | Notificaciones propias; meta.no_leidas trae el contador. |
| `PATCH` | `/api/notifications/{{idNotificacion}}/read` | Autenticado | RF-28 | Marca una notificación. |
| `PATCH` | `/api/notifications/read-all` | Autenticado | RF-28 | Marca todas las notificaciones propias. |

### Denuncias

| Método | Ruta | Quién | Requisito | Descripción |
| --- | --- | --- | --- | --- |
| `POST` | `/api/complaints` | Turista, Anfitrión, Negocio local | RF-34 | Envía id_servicio o id_calificacion (uno solo) y el motivo. |

### Administración

| Método | Ruta | Quién | Requisito | Descripción |
| --- | --- | --- | --- | --- |
| `GET` | `/api/admin/users` | Administrador | RF-31 | Filtros por rol, estado y texto. |
| `PATCH` | `/api/admin/users/{{idUsuario}}/status` | Administrador | RF-31 | Cambie el estado a SUSPENDIDO para suspender la cuenta: no podrá iniciar sesión ni publicar. |
| `GET` | `/api/admin/services` | Administrador | RF-32 | Publicaciones en cualquier estado. |
| `PATCH` | `/api/admin/services/{{idServicio}}/moderation` | Administrador | RF-32 | accion OCULTAR (con motivo) o RESTAURAR; notifica al anfitrión. |
| `DELETE` | `/api/admin/services/{{idServicio}}` | Administrador | RF-32 | Con reservas se oculta en lugar de borrarse. |
| `GET` | `/api/admin/reviews` | Administrador | RF-33 | Reseñas visibles u ocultas. |
| `PATCH` | `/api/admin/reviews/{{idCalificacion}}/moderation` | Administrador | RF-33 | Recalcula el promedio del servicio. |
| `PATCH` | `/api/admin/reviews/{{idCalificacion}}/moderation` | Administrador | RF-33 | Vuelve a mostrar la reseña y recalcula el promedio. |
| `DELETE` | `/api/admin/reviews/{{idCalificacionAEliminar}}` | Administrador | RF-33 | Elimina la reseña y recalcula el promedio. Defina la variable idCalificacionAEliminar con el id de la reseña (por seguridad no se borra ninguna por defecto). |
| `GET` | `/api/admin/complaints` | Administrador | RF-35 | Denuncias pendientes, resueltas o desestimadas. |
| `PATCH` | `/api/admin/complaints/{{idDenuncia}}` | Administrador | RF-35 | OCULTAR (resuelve y oculta el contenido) o DESESTIMAR. |
| `GET` | `/api/admin/reports/summary` | Administrador | RF-37 | Reservas por estado, ingresos aprobados, servicios destacados y usuarios por rol (por defecto, últimos 30 días). |

### Cuenta (irreversible, ejecutar al final)

| Método | Ruta | Quién | Requisito | Descripción |
| --- | --- | --- | --- | --- |
| `DELETE` | `/api/users/me` | Autenticado | RF-05, RNF-07 | Anonimiza los datos personales. Falla si hay reservas activas. |

## Reglas de negocio que conviene conocer

- **Cupos:** un alojamiento consume 1 cupo por *noche* (el día de salida no cuenta); una actividad consume 1 cupo por *persona* en cada día.
- **Precio:** alojamiento = `precio_base × noches`; actividad = `precio_base × personas × días`. Siempre lo calcula el backend.
- **Estados de la reserva:** `PENDIENTE_PAGO → CONFIRMADA → COMPLETADA` y `CANCELADA`. Una reserva sin pago vence a los 15 minutos
  (`RESERVATION_HOLD_MINUTES`) y libera el cupo; al terminar la fecha de la estadía pasa a `COMPLETADA`.
- **Concurrencia:** las reservas simultáneas por el último cupo se serializan con bloqueo de filas ordenado por fecha; solo una se acepta (409 `SIN_DISPONIBILIDAD` para las demás).
- **Calificaciones:** solo con reserva `COMPLETADA` y pagada, una por reserva. Las reseñas públicas muestran el nombre abreviado.
- **Moderación:** un contenido oculto no aparece en el catálogo ni puede ser reactivado por su propietario.

## Ejemplo de flujo con curl

```bash
# 1. Registro e inicio de sesión
curl -X POST localhost:3000/api/auth/register -H 'Content-Type: application/json' \
  -d '{"nombre":"Camila Rojas","correo":"camila@correo.co","contrasena":"Clave12345","rol":"TURISTA","acepta_politica":true}'
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"correo":"camila@correo.co","contrasena":"Clave12345"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

# 2. Buscar alojamientos disponibles
curl "localhost:3000/api/services?tipo=ALOJAMIENTO&localidad=Salento&fecha_inicio=2026-12-10&fecha_fin=2026-12-12&personas=2"

# 3. Reservar y pagar (pasarela simulada)
curl -X POST localhost:3000/api/bookings -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"id_servicio":1,"fecha_inicio":"2026-12-10","fecha_fin":"2026-12-12","num_personas":2}'
curl -X POST localhost:3000/api/payments/simulate -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"id_reserva":1,"metodo":"TARJETA_SIMULADA","resultado":"APROBADO"}'
```
