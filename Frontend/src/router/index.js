import { createRouter, createWebHistory } from 'vue-router'
import { estaAutenticado, sesion, rutaInicio } from '../services/auth'

import Login from '../views/Login.vue'
import Explorar from '../views/Explorar.vue'
import Detalle from '../views/Detalle.vue'

const TURISTA = ['TURISTA']
const ANFITRION = ['ANFITRION', 'NEGOCIO_LOCAL']
const ADMIN = ['ADMINISTRADOR']

const routes = [
  { path: '/', name: 'Login', component: Login, meta: { publica: true } },
  { path: '/registro', name: 'Registro', component: () => import('../views/Registro.vue'), meta: { publica: true } },

  // ---- Turista ----
  { path: '/explorar', name: 'Explorar', component: Explorar, meta: { roles: TURISTA } },
  { path: '/destino/:id', name: 'Detalle', component: Detalle, meta: { roles: TURISTA } },
  { path: '/reserva/:id', name: 'Reserva', component: () => import('../views/Reserva.vue'), meta: { roles: TURISTA } },
  { path: '/pago/:id', name: 'Pago', component: () => import('../views/Pago.vue'), meta: { roles: TURISTA } },
  { path: '/mis-reservas', name: 'MisReservas', component: () => import('../views/MisReservas.vue'), meta: { roles: TURISTA } },
  { path: '/perfil', name: 'Perfil', component: () => import('../views/Perfil.vue'), meta: { roles: TURISTA } },
  { path: '/configuracion', name: 'Configuracion', component: () => import('../views/Configuracion.vue'), meta: { roles: TURISTA } },
  { path: '/notificaciones', name: 'Notificaciones', component: () => import('../views/Notificaciones.vue'), meta: { roles: TURISTA } },
  { path: '/resenas', name: 'Resenas', component: () => import('../views/Resenas.vue'), meta: { roles: TURISTA } },
  { path: '/mapa', name: 'Mapa', component: () => import('../views/Mapa.vue'), meta: { roles: TURISTA } },

  // ---- Anfitrión y negocio local ----
  { path: '/anfitrion', name: 'AnfitrionResumen', component: () => import('../views/anfitrion/Resumen.vue'), meta: { roles: ANFITRION } },
  { path: '/anfitrion/publicaciones', name: 'AnfitrionPublicaciones', component: () => import('../views/anfitrion/Publicaciones.vue'), meta: { roles: ANFITRION } },
  { path: '/anfitrion/publicaciones/nueva', name: 'AnfitrionNueva', component: () => import('../views/anfitrion/PublicacionForm.vue'), meta: { roles: ANFITRION } },
  { path: '/anfitrion/publicaciones/:id', name: 'AnfitrionEditar', component: () => import('../views/anfitrion/PublicacionForm.vue'), meta: { roles: ANFITRION } },
  { path: '/anfitrion/publicaciones/:id/disponibilidad', name: 'AnfitrionDisponibilidad', component: () => import('../views/anfitrion/Disponibilidad.vue'), meta: { roles: ['ANFITRION'] } },
  { path: '/anfitrion/reservas', name: 'AnfitrionReservas', component: () => import('../views/anfitrion/Reservas.vue'), meta: { roles: ['ANFITRION'] } },
  { path: '/anfitrion/notificaciones', name: 'AnfitrionNotificaciones', component: () => import('../views/panel/PanelNotificaciones.vue'), meta: { roles: ANFITRION } },
  { path: '/anfitrion/cuenta', name: 'AnfitrionCuenta', component: () => import('../views/panel/PanelCuenta.vue'), meta: { roles: ANFITRION } },

  // ---- Administrador ----
  { path: '/admin', name: 'AdminResumen', component: () => import('../views/admin/Resumen.vue'), meta: { roles: ADMIN } },
  { path: '/admin/usuarios', name: 'AdminUsuarios', component: () => import('../views/admin/Usuarios.vue'), meta: { roles: ADMIN } },
  { path: '/admin/publicaciones', name: 'AdminPublicaciones', component: () => import('../views/admin/Publicaciones.vue'), meta: { roles: ADMIN } },
  { path: '/admin/resenas', name: 'AdminResenas', component: () => import('../views/admin/Resenas.vue'), meta: { roles: ADMIN } },
  { path: '/admin/denuncias', name: 'AdminDenuncias', component: () => import('../views/admin/Denuncias.vue'), meta: { roles: ADMIN } },
  { path: '/admin/reservas', name: 'AdminReservas', component: () => import('../views/admin/Reservas.vue'), meta: { roles: ADMIN } },
  { path: '/admin/categorias', name: 'AdminCategorias', component: () => import('../views/admin/Categorias.vue'), meta: { roles: ADMIN } },
  { path: '/admin/notificaciones', name: 'AdminNotificaciones', component: () => import('../views/panel/PanelNotificaciones.vue'), meta: { roles: ADMIN } },
  { path: '/admin/cuenta', name: 'AdminCuenta', component: () => import('../views/panel/PanelCuenta.vue'), meta: { roles: ADMIN } },

  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

// Login y Registro son públicas. El resto exige sesión y que el rol corresponda a la sección.
// (El backend vuelve a validar los permisos en cada petición: esto solo evita pantallas equivocadas.)
router.beforeEach((to) => {
  const conSesion = estaAutenticado()

  if (to.meta.publica) {
    return conSesion ? rutaInicio() : true
  }

  if (!conSesion) {
    return { path: '/', query: { redirect: to.fullPath } }
  }

  const permitidos = to.meta.roles || TURISTA

  if (!permitidos.includes(sesion.usuario?.rol)) {
    return rutaInicio()
  }

  return true
})

export default router
