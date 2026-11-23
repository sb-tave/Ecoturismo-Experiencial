# Raíz · Frontend (Vue 3 + Vite)

Aplicación conectada al backend `ecoturismo-backend`, con tres experiencias según el rol de la cuenta.

## Arranque

1. Backend (carpeta `ecoturismo-backend`): `docker compose up --build` y, una sola vez,
   `docker compose exec api node scripts/seed.js --demo --force`
2. Frontend (esta carpeta): `npm install` y `npm run dev` → http://localhost:5173

La URL del backend está en `.env` (`VITE_API_URL`). El origen del frontend debe estar en `CORS_ORIGINS` del backend.

## Cuentas de prueba (seed demo)

| Rol | Correo | Contraseña | Entra a |
|---|---|---|---|
| Turista | turista@demo.test | Demo12345 | `/explorar` |
| Anfitrión | anfitrion@demo.test | Demo12345 | `/anfitrion` |
| Administrador | admin@ecoturismo.local | Admin12345 | `/admin` |

También se puede crear una cuenta de turista, anfitrión o negocio local desde «Regístrate».

## Qué hace cada rol

**Turista (diseño móvil):** explorar con filtros, mapa, detalle con galería y reseñas, reservar con disponibilidad real,
**pagar** (`/pago/:id`), mis reservas (pagar, cancelar), reseñas, denunciar contenido, notificaciones, perfil y configuración.

**Anfitrión (panel):** resumen, publicaciones (crear, editar, activar, eliminar), fotos, disponibilidad
(definir cupos y bloquear días), reservas recibidas, notificaciones y cuenta.

**Negocio local (panel):** igual que el anfitrión, sin reservas ni disponibilidad.

**Administrador (panel):** resumen con reportes, usuarios (suspender/reactivar), moderación de publicaciones y reseñas,
denuncias, reservas (cancelar), categorías, notificaciones y cuenta.

## Estructura de la conexión

- `src/services/api.js` cliente axios, token JWT, manejo de 401 y de errores `{ error: { code, message, details } }`
- `src/services/auth.js` sesión, roles y ruta de inicio por rol
- `src/services/destinos.js`, `reservas.js`, `notificaciones.js`, `denuncias.js` turista
- `src/services/anfitrion.js` publicaciones, fotos y disponibilidad
- `src/services/admin.js` usuarios, moderación, denuncias, reportes y categorías
- `src/router/index.js` rutas protegidas por rol (el backend vuelve a validar los permisos)
- `src/components/PanelLayout.vue` diseño de los paneles (menú lateral en escritorio, superior en celular)
