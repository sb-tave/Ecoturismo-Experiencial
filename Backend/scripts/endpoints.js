// Fuente única de los endpoints: de aquí se generan docs/API.md y la colección de Postman (npm run docs).
// Convención en los cuerpos: "#nombre" = variable numérica de Postman; "{{nombre}}" = variable de texto.
const T = 'tokenTurista';
const A = 'tokenAnfitrion';
const N = 'tokenNegocio';
const ADM = 'tokenAdmin';
const guardar = (variable, ruta) => `pm.collectionVariables.set('${variable}', pm.response.json()${ruta});`;

export const carpetas = [
  {
    nombre: 'Salud',
    endpoints: [
      { n: 'Servidor en línea', m: 'GET', r: '/health', rol: 'Público', d: 'Comprueba que el servidor responde.' },
      { n: 'Base de datos disponible', m: 'GET', r: '/health/ready', rol: 'Público', d: 'Comprueba la conexión con PostgreSQL (503 si no hay).' },
    ],
  },
  {
    nombre: '1. Autenticación',
    endpoints: [
      { n: 'Versión vigente de la política de datos', m: 'GET', r: '/api/auth/policy', rol: 'Público', rf: 'RF-02', d: 'Devuelve la versión de la política que se debe aceptar al registrarse.' },
      { n: 'Registrar turista', m: 'POST', r: '/api/auth/register', rol: 'Público', rf: 'RF-01, RF-02', d: 'Crea una cuenta (TURISTA, ANFITRION o NEGOCIO_LOCAL). Exige acepta_politica=true. Nunca crea administradores.',
        pre: "pm.collectionVariables.set('correoTurista', 'turista-' + Date.now() + '@prueba.test');",
        body: { nombre: 'Camila Rojas', correo: '{{correoTurista}}', contrasena: 'Clave12345', telefono: '3001234567', rol: 'TURISTA', acepta_politica: true } },
      { n: 'Registrar anfitrión', m: 'POST', r: '/api/auth/register', rol: 'Público', rf: 'RF-01', d: 'Igual que el anterior con rol ANFITRION.',
        pre: "pm.collectionVariables.set('correoAnfitrion', 'anfitrion-' + Date.now() + '@prueba.test');",
        body: { nombre: 'Andrés Molina', correo: '{{correoAnfitrion}}', contrasena: 'Clave12345', rol: 'ANFITRION', acepta_politica: true } },
      { n: 'Iniciar sesión (turista)', m: 'POST', r: '/api/auth/login', rol: 'Público', rf: 'RF-03', d: 'Devuelve un token JWT (Bearer). Los errores de credenciales son genéricos.',
        body: { correo: '{{correoTurista}}', contrasena: 'Clave12345' }, test: [guardar(T, '.token')] },
      { n: 'Iniciar sesión (anfitrión)', m: 'POST', r: '/api/auth/login', rol: 'Público', rf: 'RF-03', d: 'Inicio de sesión del anfitrión.',
        body: { correo: '{{correoAnfitrion}}', contrasena: 'Clave12345' }, test: [guardar(A, '.token')] },
      { n: 'Iniciar sesión (administrador)', m: 'POST', r: '/api/auth/login', rol: 'Público', rf: 'RF-03', d: 'Usa la cuenta creada con npm run seed (variables adminCorreo y adminContrasena).',
        body: { correo: '{{adminCorreo}}', contrasena: '{{adminContrasena}}' }, test: [guardar(ADM, '.token')] },
      { n: 'Cerrar sesión', m: 'POST', r: '/api/auth/logout', as: T, rol: 'Autenticado', rf: 'RF-03', d: 'El cliente descarta el token (JWT sin estado, RNF-10).' },
    ],
  },
  {
    nombre: '2. Perfil',
    endpoints: [
      { n: 'Mi perfil', m: 'GET', r: '/api/users/me', as: T, rol: 'Autenticado', rf: 'RF-05, RNF-07', d: 'Consulta los datos personales del titular.' },
      { n: 'Actualizar mi perfil', m: 'PATCH', r: '/api/users/me', as: T, rol: 'Autenticado', rf: 'RF-05', d: 'Actualiza nombre y teléfono.', body: { nombre: 'Camila R. Rojas', telefono: '3009876543' } },
      { n: 'Cambiar contraseña', m: 'PATCH', r: '/api/users/me/password', as: T, rol: 'Autenticado', rf: 'RF-05', d: 'Exige la contraseña actual.', body: { contrasena_actual: 'Clave12345', contrasena_nueva: 'Clave12345' } },
    ],
  },
  {
    nombre: '3. Categorías',
    endpoints: [
      { n: 'Listar categorías', m: 'GET', r: '/api/categories', rol: 'Público', rf: 'RF-11', d: 'Categorías activas. El administrador puede usar ?todas=true.', test: ["const c = pm.response.json().data; if (c.length) pm.collectionVariables.set('idCategoria', c[0].id_categoria);"] },
      { n: 'Crear categoría', m: 'POST', r: '/api/categories', as: ADM, rol: 'Administrador', rf: 'RF-11', d: 'Crea una categoría.', body: { nombre: 'Turismo de aventura', descripcion: 'Actividades de naturaleza y aventura' }, test: [guardar('idCategoriaNueva', '.id_categoria')] },
      { n: 'Editar o desactivar categoría', m: 'PATCH', r: '/api/categories/{{idCategoriaNueva}}', as: ADM, rol: 'Administrador', rf: 'RF-11', d: 'Cambia nombre, descripción o activa.', body: { descripcion: 'Aventura y deportes de naturaleza' } },
      { n: 'Eliminar categoría', m: 'DELETE', r: '/api/categories/{{idCategoriaNueva}}', as: ADM, rol: 'Administrador', rf: 'RF-11', d: 'Si tiene servicios solo se desactiva.' },
    ],
  },
  {
    nombre: '4. Servicios',
    endpoints: [
      { n: 'Publicar alojamiento', m: 'POST', r: '/api/services', as: A, rol: 'Anfitrión', rf: 'RF-06', d: 'Publica un alojamiento (queda ACTIVO y visible al guardarlo).',
        body: { tipo: 'ALOJAMIENTO', id_categoria: '#idCategoria', titulo: 'Cabaña junto al río', descripcion: 'Hospedaje rural con senderos y desayuno incluido.', precio_base: 180000, capacidad_max: 4, localidad: 'Salento', direccion: 'Vereda de ejemplo', latitud: 4.6372, longitud: -75.57 },
        test: [guardar('idServicio', '.id_servicio')] },
      { n: 'Publicar actividad', m: 'POST', r: '/api/services', as: A, rol: 'Anfitrión', rf: 'RF-06', d: 'Publica una actividad (precio por persona).',
        body: { tipo: 'ACTIVIDAD', id_categoria: '#idCategoria', titulo: 'Caminata al amanecer', descripcion: 'Ruta guiada por el bosque de niebla.', precio_base: 50000, capacidad_max: 10, localidad: 'Salento', latitud: 4.642, longitud: -75.565 },
        test: [guardar('idActividad', '.id_servicio')] },
      { n: 'Buscar con filtros', m: 'GET', r: '/api/services?q=caba%C3%B1a&tipo=ALOJAMIENTO&precio_max=300000&personas=2&orden=precio_asc&page=1&limit=10', rol: 'Público', rf: 'RF-12, RF-13',
        d: 'Filtros: q, tipo, id_categoria, localidad, precio_min/max, calificacion_min, personas, fecha_inicio+fecha_fin, orden y paginación.' },
      { n: 'Buscar por fechas disponibles', m: 'GET', r: '/api/services?fecha_inicio={{inicio}}&fecha_fin={{fin}}&personas=2', rol: 'Público', rf: 'RF-13', d: 'Solo servicios con cupos en todas las fechas pedidas.' },
      { n: 'Buscar por cercanía', m: 'GET', r: '/api/services?lat=4.6372&lng=-75.57&radio_km=30', rol: 'Público', rf: 'RF-15', d: 'Ordena por distancia (distancia_km) dentro del radio.' },
      { n: 'Detalle de un servicio', m: 'GET', r: '/api/services/{{idServicio}}', rol: 'Público', rf: 'RF-16', d: 'Datos, fotos, promedio y anfitrión. Los inactivos solo los ve su propietario o el administrador.' },
      { n: 'Mis publicaciones', m: 'GET', r: '/api/services/mine?page=1&limit=20', as: A, rol: 'Anfitrión, Negocio local', rf: 'RF-06', d: 'Lista las publicaciones propias en cualquier estado.' },
      { n: 'Editar publicación', m: 'PATCH', r: '/api/services/{{idServicio}}', as: A, rol: 'Propietario', rf: 'RF-07, RF-08', d: 'Edita campos o cambia estado (ACTIVO/INACTIVO). No cambia el tipo.', body: { precio_base: 200000 } },
      { n: 'Eliminar o desactivar publicación', m: 'DELETE', r: '/api/services/{{idActividad}}', as: A, rol: 'Propietario', rf: 'RF-08', d: 'Sin reservas se elimina; con reservas solo se desactiva.' },
      { n: 'Definir disponibilidad', m: 'PUT', r: '/api/services/{{idServicio}}/availability', as: A, rol: 'Anfitrión propietario', rf: 'RF-17', d: 'Cupos por día para un periodo (máx. 366 días). No baja de lo ya reservado.', body: { desde: '{{desde}}', hasta: '{{hasta}}', cupos_totales: 2 } },
      { n: 'Consultar calendario', m: 'GET', r: '/api/services/{{idServicio}}/availability?desde={{desde}}&hasta={{hasta}}', rol: 'Público', rf: 'RF-18', d: 'Cupos por día; los días sin registro no están disponibles.' },
      { n: 'Bloquear fechas', m: 'POST', r: '/api/services/{{idServicio}}/availability/block', as: A, rol: 'Anfitrión propietario', rf: 'RF-17', d: 'Bloquea los días sin reservas e informa los que tienen reservas.', body: { desde: '{{hasta}}', hasta: '{{hasta}}' } },
      { n: 'Subir fotografía', ok: [201, 400], m: 'POST', r: '/api/services/{{idServicio}}/photos', as: A, rol: 'Propietario', rf: 'RF-09', d: 'multipart/form-data, campo «foto» (JPG, PNG o WebP, máx. 5 MB). Se convierte a WebP.', archivo: 'foto', test: [guardar('idFoto', '.id_foto')] },
      { n: 'Cambiar foto principal u orden', ok: [200, 400, 404], m: 'PATCH', r: '/api/services/{{idServicio}}/photos/{{idFoto}}', as: A, rol: 'Propietario', rf: 'RF-09', d: 'Marca la foto principal o cambia su orden.', body: { es_principal: true, orden: 1 } },
      { n: 'Eliminar fotografía', ok: [200, 400, 404], m: 'DELETE', r: '/api/services/{{idServicio}}/photos/{{idFoto}}', as: A, rol: 'Propietario', rf: 'RF-09', d: 'Elimina la foto y su archivo.' },
    ],
  },
  {
    nombre: '5. Reservas',
    endpoints: [
      { n: 'Crear reserva', m: 'POST', r: '/api/bookings', as: T, rol: 'Turista', rf: 'RF-19, RF-20', d: 'Reserva pendiente de pago; descuenta cupos de forma atómica y devuelve el comprobante.', body: { id_servicio: '#idServicio', fecha_inicio: '{{inicio}}', fecha_fin: '{{fin}}', num_personas: 2 }, test: [guardar('idReserva', '.id_reserva')] },
      { n: 'Mis reservas / reservas recibidas', m: 'GET', r: '/api/bookings?estado=PENDIENTE_PAGO&page=1&limit=20', as: T, rol: 'Turista, Anfitrión, Administrador', rf: 'RF-23, RF-25, RF-36', d: 'El turista ve las suyas, el anfitrión las de sus servicios y el administrador todas.' },
      { n: 'Detalle de una reserva', m: 'GET', r: '/api/bookings/{{idReserva}}', as: T, rol: 'Turista dueño, Anfitrión propietario, Administrador', rf: 'RF-23', d: 'Incluye los intentos de pago.' },
    ],
  },
  {
    nombre: '6. Pagos simulados y cancelación',
    endpoints: [
      { n: 'Pagar (rechazado)', m: 'POST', r: '/api/payments/simulate', as: T, rol: 'Turista', rf: 'RF-27', d: 'Simula un rechazo: la reserva sigue pendiente y se puede reintentar.', body: { id_reserva: '#idReserva', metodo: 'TRANSFERENCIA_SIMULADA', resultado: 'RECHAZADO' } },
      { n: 'Pagar (aprobado)', m: 'POST', r: '/api/payments/simulate', as: T, rol: 'Turista', rf: 'RF-26, RF-27', d: 'Pasarela simulada. El monto lo calcula el backend; no se envían datos de tarjeta.', body: { id_reserva: '#idReserva', metodo: 'TARJETA_SIMULADA', resultado: 'APROBADO' } },
      { n: 'Pagos de una reserva', m: 'GET', r: '/api/payments?id_reserva={{idReserva}}', as: T, rol: 'Turista, Anfitrión propietario, Administrador', rf: 'RF-27', d: 'Lista los intentos de pago.' },
      { n: 'Cancelar reserva', m: 'PATCH', r: '/api/bookings/{{idReserva}}/cancel', as: T, rol: 'Turista, Administrador', rf: 'RF-24, RF-36', d: 'Libera los cupos. No aplica a reservas completadas.', body: { motivo: 'Cambio de planes' } },
    ],
  },
  {
    nombre: '7. Calificaciones y notificaciones',
    endpoints: [
      { n: 'Listar reseñas de un servicio', m: 'GET', r: '/api/services/{{idServicio}}/reviews?page=1&limit=10', rol: 'Público', rf: 'RF-16, RF-30', d: 'Reseñas visibles, promedio y distribución por estrellas.' },
      { n: 'Calificar un servicio', ok: [201, 400, 404, 409], m: 'POST', r: '/api/services/{{idServicio}}/reviews', as: T, rol: 'Turista', rf: 'RF-29', d: 'Solo con una reserva COMPLETADA y pagada (una reseña por reserva).', body: { id_reserva: '#idReservaCompletada', puntuacion: 5, comentario: 'Excelente lugar' } },
      { n: 'Mis notificaciones', m: 'GET', r: '/api/notifications?no_leidas=true', as: A, rol: 'Autenticado', rf: 'RF-28', d: 'Notificaciones propias; meta.no_leidas trae el contador.', test: ["const n = pm.response.json().data; if (n.length) pm.collectionVariables.set('idNotificacion', n[0].id_notificacion);"] },
      { n: 'Marcar notificación como leída', ok: [200, 404], m: 'PATCH', r: '/api/notifications/{{idNotificacion}}/read', as: A, rol: 'Autenticado', rf: 'RF-28', d: 'Marca una notificación.' },
      { n: 'Marcar todas como leídas', m: 'PATCH', r: '/api/notifications/read-all', as: A, rol: 'Autenticado', rf: 'RF-28', d: 'Marca todas las notificaciones propias.' },
    ],
  },
  {
    nombre: '8. Denuncias',
    endpoints: [
      { n: 'Denunciar una publicación', m: 'POST', r: '/api/complaints', as: T, rol: 'Turista, Anfitrión, Negocio local', rf: 'RF-34', d: 'Envía id_servicio o id_calificacion (uno solo) y el motivo.', body: { id_servicio: '#idServicio', motivo: 'Información engañosa en las fotos' }, test: [guardar('idDenuncia', '.id_denuncia')] },
    ],
  },
  {
    nombre: '9. Administración',
    endpoints: [
      { n: 'Listar usuarios', m: 'GET', r: '/api/admin/users?rol=ANFITRION&estado=ACTIVO&q=molina', as: ADM, rol: 'Administrador', rf: 'RF-31', d: 'Filtros por rol, estado y texto.', test: ["const u = pm.response.json().data; if (u.length) pm.collectionVariables.set('idUsuario', u[0].id_usuario);"] },
      { n: 'Suspender o reactivar usuario', m: 'PATCH', r: '/api/admin/users/{{idUsuario}}/status', as: ADM, rol: 'Administrador', rf: 'RF-31', d: 'Cambie el estado a SUSPENDIDO para suspender la cuenta: no podrá iniciar sesión ni publicar.', body: { estado: 'ACTIVO' } },
      { n: 'Listar publicaciones', m: 'GET', r: '/api/admin/services?estado=ACTIVO', as: ADM, rol: 'Administrador', rf: 'RF-32', d: 'Publicaciones en cualquier estado.' },
      { n: 'Ocultar o restaurar publicación', m: 'PATCH', r: '/api/admin/services/{{idServicio}}/moderation', as: ADM, rol: 'Administrador', rf: 'RF-32', d: 'accion OCULTAR (con motivo) o RESTAURAR; notifica al anfitrión.', body: { accion: 'OCULTAR', motivo: 'Contenido inapropiado' } },
      { n: 'Eliminar publicación', m: 'DELETE', r: '/api/admin/services/{{idServicio}}', as: ADM, rol: 'Administrador', rf: 'RF-32', d: 'Con reservas se oculta en lugar de borrarse.', body: { motivo: 'Publicación fraudulenta' } },
      { n: 'Listar reseñas', m: 'GET', r: '/api/admin/reviews?estado=VISIBLE', as: ADM, rol: 'Administrador', rf: 'RF-33', d: 'Reseñas visibles u ocultas.', test: ["const r = pm.response.json().data; if (r.length) pm.collectionVariables.set('idCalificacion', r[0].id_calificacion);"] },
      { n: 'Ocultar o restaurar reseña', ok: [200, 404, 409], m: 'PATCH', r: '/api/admin/reviews/{{idCalificacion}}/moderation', as: ADM, rol: 'Administrador', rf: 'RF-33', d: 'Recalcula el promedio del servicio.', body: { accion: 'OCULTAR', motivo: 'Lenguaje ofensivo' } },
      { n: 'Restaurar reseña', m: 'PATCH', r: '/api/admin/reviews/{{idCalificacion}}/moderation', as: ADM, rol: 'Administrador', rf: 'RF-33', ok: [200, 404, 409], d: 'Vuelve a mostrar la reseña y recalcula el promedio.', body: { accion: 'RESTAURAR' } },
      { n: 'Eliminar reseña', ok: [200, 400, 404], m: 'DELETE', r: '/api/admin/reviews/{{idCalificacionAEliminar}}', as: ADM, rol: 'Administrador', rf: 'RF-33', d: 'Elimina la reseña y recalcula el promedio. Defina la variable idCalificacionAEliminar con el id de la reseña (por seguridad no se borra ninguna por defecto).', body: { motivo: 'Spam repetido' } },
      { n: 'Cola de denuncias', m: 'GET', r: '/api/admin/complaints?estado=PENDIENTE', as: ADM, rol: 'Administrador', rf: 'RF-35', d: 'Denuncias pendientes, resueltas o desestimadas.' },
      { n: 'Resolver o desestimar denuncia', m: 'PATCH', r: '/api/admin/complaints/{{idDenuncia}}', as: ADM, rol: 'Administrador', rf: 'RF-35', d: 'OCULTAR (resuelve y oculta el contenido) o DESESTIMAR.', body: { accion: 'DESESTIMAR' } },
      { n: 'Reporte de reservas e ingresos', m: 'GET', r: '/api/admin/reports/summary?desde={{hoy}}&hasta={{hoy}}', as: ADM, rol: 'Administrador', rf: 'RF-37', d: 'Reservas por estado, ingresos aprobados, servicios destacados y usuarios por rol (por defecto, últimos 30 días).' },
    ],
  },
  {
    nombre: '10. Cuenta (irreversible, ejecutar al final)',
    endpoints: [
      { n: 'Eliminar mi cuenta', m: 'DELETE', r: '/api/users/me', as: T, rol: 'Autenticado', rf: 'RF-05, RNF-07', d: 'Anonimiza los datos personales. Falla si hay reservas activas.', body: { contrasena: 'Clave12345' } },
    ],
  },
];
