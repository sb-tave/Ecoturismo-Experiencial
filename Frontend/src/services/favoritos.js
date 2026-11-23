import { ref } from 'vue'

// El backend no tiene favoritos: se guardan en este dispositivo
const CLAVE = 'raiz_favoritos'

function leer() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || '[]')
  } catch {
    return []
  }
}

export const favoritos = ref(leer())

export const esFavorito = (id) => favoritos.value.includes(id)

export function alternarFavorito(id) {
  favoritos.value = esFavorito(id) ? favoritos.value.filter((f) => f !== id) : [...favoritos.value, id]
  localStorage.setItem(CLAVE, JSON.stringify(favoritos.value))
}
