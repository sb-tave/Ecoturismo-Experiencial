import api from './api'

export async function listarNotificaciones(params = {}) {
  const { data } = await api.get('/notifications', { params })
  return data // { data, meta: { no_leidas, ... } }
}

export async function contarNoLeidas() {
  const { data } = await api.get('/notifications', { params: { no_leidas: 'true', limit: 1 } })
  return data.meta.no_leidas
}

export async function marcarLeida(id) {
  const { data } = await api.patch(`/notifications/${id}/read`)
  return data
}

export async function marcarTodasLeidas() {
  const { data } = await api.patch('/notifications/read-all')
  return data
}
