import api from './api'

const limpiar = (p) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== '' && v != null))

// ---- Publicaciones propias (devuelven los campos tal como los entrega el backend) ----

export async function listarMisServicios(params = {}) {
  const { data } = await api.get('/services/mine', { params: limpiar(params) })
  return data // { data, meta }
}

export async function detalleServicio(id) {
  const { data } = await api.get(`/services/${id}`)
  return data // incluye fotos [{ id_foto, url, orden, es_principal }]
}

export async function crearServicio(cuerpo) {
  const { data } = await api.post('/services', cuerpo)
  return data
}

export async function actualizarServicio(id, cuerpo) {
  const { data } = await api.patch(`/services/${id}`, cuerpo)
  return data
}

// Con reservas no se borra: el backend la desactiva y lo informa en "eliminado: false"
export async function eliminarServicio(id) {
  const { data } = await api.delete(`/services/${id}`)
  return data
}

// ---- Fotos (RF-09): JPG, PNG o WebP, máximo 5 MB, campo "foto" ----

export async function subirFoto(idServicio, archivo) {
  const formulario = new FormData()
  formulario.append('foto', archivo)
  const { data } = await api.post(`/services/${idServicio}/photos`, formulario, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return data
}

export async function actualizarFoto(idServicio, idFoto, cuerpo) {
  const { data } = await api.patch(`/services/${idServicio}/photos/${idFoto}`, cuerpo)
  return data
}

export async function eliminarFoto(idServicio, idFoto) {
  const { data } = await api.delete(`/services/${idServicio}/photos/${idFoto}`)
  return data
}

// ---- Disponibilidad (RF-17) ----

export async function definirDisponibilidad(idServicio, { desde, hasta, cupos_totales }) {
  const { data } = await api.put(`/services/${idServicio}/availability`, { desde, hasta, cupos_totales })
  return data
}

export async function bloquearFechas(idServicio, { desde, hasta }) {
  const { data } = await api.post(`/services/${idServicio}/availability/block`, { desde, hasta })
  return data // { bloqueadas: [...], con_reservas: [...] }
}
