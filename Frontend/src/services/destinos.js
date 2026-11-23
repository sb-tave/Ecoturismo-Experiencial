import api from './api'
import heroImage from '../assets/hero.png'

export const TIPOS = {
  ALOJAMIENTO: { etiqueta: 'Alojamiento', unidad: 'noche' },
  ACTIVIDAD: { etiqueta: 'Actividad', unidad: 'persona' },
  NEGOCIO_LOCAL: { etiqueta: 'Negocio local', unidad: null }
}

// Convierte un servicio del backend en el formato que usan las pantallas
export function adaptarServicio(s) {
  const fotos = s.fotos?.length ? s.fotos.map((f) => f.url) : []
  const imagen = s.foto_principal || fotos[0] || heroImage
  return {
    id: s.id_servicio,
    tipo: s.tipo,
    nombre: s.titulo,
    ubicacion: s.localidad,
    direccion: s.direccion ?? null,
    categoria: s.categoria,
    idCategoria: s.id_categoria,
    precio: s.precio_base ?? null,
    unidadPrecio: TIPOS[s.tipo]?.unidad ?? null,
    capacidad: s.capacidad_max ?? null,
    calificacion: s.promedio_calificacion ?? null,
    resenas: s.total_calificaciones ?? 0,
    imagen,
    fotos: fotos.length ? fotos : [imagen],
    latitud: s.latitud ?? null,
    longitud: s.longitud ?? null,
    descripcion: s.descripcion ?? s.descripcion_corta ?? '',
    contacto: s.contacto ?? null,
    anfitrion: s.anfitrion?.nombre ?? null,
    distanciaKm: s.distancia_km ?? null
  }
}

const limpiar = (params) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))

export async function listarServicios(params = {}) {
  const { data } = await api.get('/services', { params: limpiar(params) })
  return { destinos: data.data.map(adaptarServicio), meta: data.meta }
}

export async function obtenerServicio(id) {
  const { data } = await api.get(`/services/${id}`)
  return adaptarServicio(data)
}

export async function listarCategorias() {
  const { data } = await api.get('/categories')
  return data.data
}

// Cupos por día entre dos fechas (AAAA-MM-DD). Devuelve { reservable, dias: [{ fecha, cupos_disponibles, disponible }] }
export async function obtenerDisponibilidad(id, desde, hasta) {
  const { data } = await api.get(`/services/${id}/availability`, { params: { desde, hasta } })
  return data
}

export async function listarResenasServicio(id, page = 1, limit = 5) {
  const { data } = await api.get(`/services/${id}/reviews`, { params: { page, limit } })
  return data
}
