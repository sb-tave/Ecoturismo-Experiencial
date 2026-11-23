import api from './api'

const limpiar = (p) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== '' && v != null))

// ---- Reportes (RF-37) ----
export async function resumenReportes(params = {}) {
  const { data } = await api.get('/admin/reports/summary', { params: limpiar(params) })
  return data
}

// ---- Usuarios (RF-31) ----
export async function listarUsuarios(params = {}) {
  const { data } = await api.get('/admin/users', { params: limpiar(params) })
  return data
}

export async function cambiarEstadoUsuario(id, estado) {
  const { data } = await api.patch(`/admin/users/${id}/status`, { estado })
  return data
}

// ---- Publicaciones (RF-32) ----
export async function listarServiciosAdmin(params = {}) {
  const { data } = await api.get('/admin/services', { params: limpiar(params) })
  return data
}

export async function ocultarServicio(id, motivo) {
  const { data } = await api.patch(`/admin/services/${id}/moderation`, { accion: 'OCULTAR', motivo })
  return data
}

export async function restaurarServicio(id) {
  const { data } = await api.patch(`/admin/services/${id}/moderation`, { accion: 'RESTAURAR' })
  return data
}

export async function eliminarServicioAdmin(id, motivo) {
  const { data } = await api.delete(`/admin/services/${id}`, { data: { motivo } })
  return data
}

// ---- Reseñas (RF-33) ----
export async function listarResenasAdmin(params = {}) {
  const { data } = await api.get('/admin/reviews', { params: limpiar(params) })
  return data
}

export async function ocultarResena(id, motivo) {
  const { data } = await api.patch(`/admin/reviews/${id}/moderation`, { accion: 'OCULTAR', motivo })
  return data
}

export async function restaurarResena(id) {
  const { data } = await api.patch(`/admin/reviews/${id}/moderation`, { accion: 'RESTAURAR' })
  return data
}

export async function eliminarResenaAdmin(id, motivo) {
  const { data } = await api.delete(`/admin/reviews/${id}`, { data: { motivo } })
  return data
}

// ---- Denuncias (RF-35) ----
export async function listarDenuncias(params = {}) {
  const { data } = await api.get('/admin/complaints', { params: limpiar(params) })
  return data
}

// accion: 'OCULTAR' (oculta el contenido y resuelve) | 'DESESTIMAR'
export async function resolverDenuncia(id, accion) {
  const { data } = await api.patch(`/admin/complaints/${id}`, { accion })
  return data
}

// ---- Categorías (RF-11) ----
export async function listarCategoriasAdmin() {
  const { data } = await api.get('/categories', { params: { todas: 'true' } })
  return data.data
}

export async function crearCategoria({ nombre, descripcion }) {
  const { data } = await api.post('/categories', { nombre, descripcion: descripcion || null })
  return data
}

export async function actualizarCategoria(id, cuerpo) {
  const { data } = await api.patch(`/categories/${id}`, cuerpo)
  return data
}

export async function eliminarCategoria(id) {
  const { data } = await api.delete(`/categories/${id}`)
  return data
}
