import axios from 'axios'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
export const TOKEN_KEY = 'raiz_token'

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
})

// Adjunta el token JWT a cada solicitud
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Si el token venció o es inválido, se cierra la sesión (lo registra main.js)
let alExpirar = null
export function alExpirarSesion(fn) {
  alExpirar = fn
}

api.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    const noEsLogin = !String(error.config?.url || '').includes('/auth/login')
    if (error.response?.status === 401 && noEsLogin && alExpirar) alExpirar()
    return Promise.reject(error)
  }
)

// ---- Utilidades para leer los errores del backend: { error: { code, message, details } }

export function codigoError(error) {
  if (error?.esLocal) return error.codigo || 'LOCAL'
  if (!error?.response) return 'SIN_CONEXION'
  return error.response.data?.error?.code || 'DESCONOCIDO'
}

export function detallesError(error) {
  return error?.response?.data?.error?.details || null
}

export function mensajeError(error, porDefecto = 'Ocurrió un error. Inténtalo de nuevo.') {
  if (error?.esLocal) return error.message
  if (!error?.response) {
    return error?.code === 'ECONNABORTED'
      ? 'El servidor tardó demasiado en responder.'
      : 'No pudimos conectar con el servidor. Revisa tu conexión.'
  }
  if (error.response.status === 429) return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'
  const e = error.response.data?.error
  if (e?.code === 'VALIDACION' && Array.isArray(e.details) && e.details.length) {
    return e.details.map((d) => d.mensaje).join(' · ')
  }
  return e?.message || porDefecto
}

// { correo: 'Correo electrónico inválido', ... } para pintar el error bajo cada campo
export function erroresPorCampo(error) {
  const mapa = {}
  for (const d of detallesError(error) || []) {
    if (d.campo && !mapa[d.campo]) mapa[d.campo] = d.mensaje
  }
  return mapa
}

export default api
