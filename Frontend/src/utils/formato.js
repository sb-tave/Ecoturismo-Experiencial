export const dinero = (n) => `$${Number(n ?? 0).toLocaleString('es-CO')}`

// 'AAAA-MM-DD' -> fecha local (T12:00 evita desfases por zona horaria)
const aFecha = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00`)

export const fechaLarga = (iso) =>
  iso ? aFecha(iso).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''

export const fechaCorta = (iso) =>
  iso ? aFecha(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

export const fechaHora = (iso) =>
  iso ? new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

export function aISO(fecha) {
  const a = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${a}-${m}-${d}`
}

export function sumarDias(iso, n) {
  const f = aFecha(iso)
  f.setDate(f.getDate() + n)
  return aISO(f)
}

export const diferenciaDias = (hasta, desde) => Math.round((aFecha(hasta) - aFecha(desde)) / 86400000)

export function mmss(segundos) {
  const s = Math.max(0, Math.floor(segundos))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
