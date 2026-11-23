import { reactive } from 'vue'
import api, { TOKEN_KEY } from './api'

const USER_KEY = 'raiz_usuario'

function leerUsuario() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

export const sesion = reactive({
  token: localStorage.getItem(TOKEN_KEY),
  usuario: leerUsuario()
})

export const estaAutenticado = () => Boolean(sesion.token)

export const ROLES = {
  TURISTA: 'Turista',
  ANFITRION: 'Anfitrión',
  NEGOCIO_LOCAL: 'Negocio local',
  ADMINISTRADOR: 'Administrador'
}

// Pantalla de inicio según el rol de la cuenta
export function rutaInicio(rol = sesion.usuario?.rol) {
  if (rol === 'ADMINISTRADOR') return '/admin'
  if (rol === 'ANFITRION' || rol === 'NEGOCIO_LOCAL') return '/anfitrion'
  return '/explorar'
}

export function inicialUsuario() {
  return (sesion.usuario?.nombre || '?').trim().charAt(0).toUpperCase()
}

function guardarUsuario(usuario) {
  sesion.usuario = usuario
  localStorage.setItem(USER_KEY, JSON.stringify(usuario))
}

function guardarSesion(token, usuario) {
  sesion.token = token
  localStorage.setItem(TOKEN_KEY, token)
  guardarUsuario(usuario)
}

export function limpiarSesion() {
  sesion.token = null
  sesion.usuario = null
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

// Versión vigente de la política de datos (RF-02)
export async function obtenerPolitica() {
  const { data } = await api.get('/auth/policy')
  return data.version
}

export async function iniciarSesion(correo, contrasena) {
  const { data } = await api.post('/auth/login', { correo, contrasena })
  guardarSesion(data.token, data.usuario)
  return data.usuario
}

export async function registrarse({ nombre, correo, telefono, contrasena, politicaVersion, rol = 'TURISTA' }) {
  await api.post('/auth/register', {
    nombre,
    correo,
    contrasena,
    ...(telefono ? { telefono } : {}),
    rol,
    acepta_politica: true,
    politica_version: politicaVersion
  })
  return iniciarSesion(correo, contrasena)
}

export async function cerrarSesion() {
  try {
    await api.post('/auth/logout')
  } catch {
    // El JWT no tiene estado en el servidor: igual se descarta en el cliente
  }
  limpiarSesion()
}

export async function cargarUsuario() {
  const { data } = await api.get('/users/me')
  guardarUsuario(data)
  return data
}

export async function actualizarPerfil({ nombre, telefono }) {
  const { data } = await api.patch('/users/me', { nombre, telefono: telefono || null })
  guardarUsuario(data)
  return data
}

export async function cambiarContrasena(contrasenaActual, contrasenaNueva) {
  await api.patch('/users/me/password', {
    contrasena_actual: contrasenaActual,
    contrasena_nueva: contrasenaNueva
  })
}

export async function eliminarCuenta(contrasena) {
  await api.delete('/users/me', { data: { contrasena } })
  limpiarSesion()
}
