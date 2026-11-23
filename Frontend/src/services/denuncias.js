import api from './api'

// RF-34: denunciar una publicación (id_servicio) o una reseña (id_calificacion)
export async function denunciar({ id_servicio, id_calificacion, motivo }) {
  const { data } = await api.post('/complaints', {
    ...(id_servicio ? { id_servicio } : {}),
    ...(id_calificacion ? { id_calificacion } : {}),
    motivo
  })
  return data
}
