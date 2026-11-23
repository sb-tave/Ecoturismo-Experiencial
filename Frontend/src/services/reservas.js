import api from './api'

export const ESTADOS_RESERVA = {
  PENDIENTE_PAGO: { etiqueta: 'Pendiente de pago', clase: 'pendiente' },
  CONFIRMADA: { etiqueta: 'Confirmada', clase: 'confirmada' },
  COMPLETADA: { etiqueta: 'Realizada', clase: 'completada' },
  CANCELADA: { etiqueta: 'Cancelada', clase: 'cancelada' }
}

export async function crearReserva({ id_servicio, fecha_inicio, fecha_fin, num_personas }) {
  const { data } = await api.post('/bookings', { id_servicio, fecha_inicio, fecha_fin, num_personas })
  return data
}

export async function listarReservas(params = {}) {
  const limpio = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
  const { data } = await api.get('/bookings', { params: limpio })
  return data // { data, meta }
}

// Incluye el arreglo "pagos" con los intentos de pago
export async function obtenerReserva(id) {
  const { data } = await api.get(`/bookings/${id}`)
  return data
}

export async function cancelarReserva(id, motivo) {
  const { data } = await api.patch(`/bookings/${id}/cancel`, motivo ? { motivo } : {})
  return data
}

// Pago simulado: el monto lo calcula el backend; nunca se envían datos de tarjeta (RNF-05)
export async function simularPago({ id_reserva, metodo, resultado }) {
  const { data } = await api.post('/payments/simulate', {
    id_reserva,
    metodo,
    ...(resultado ? { resultado } : {})
  })
  return data // { mensaje, pago, reserva }
}

export async function crearResena(idServicio, { id_reserva, puntuacion, comentario }) {
  const { data } = await api.post(`/services/${idServicio}/reviews`, { id_reserva, puntuacion, comentario })
  return data
}
