<template>
  <PanelLayout titulo="Reseñas" subtitulo="Modera las opiniones de los turistas.">

    <div class="p-filtros">
      <div class="campo">
        <label for="estado">Estado</label>
        <select id="estado" class="p-select" v-model="estado">
          <option value="">Todas</option>
          <option value="VISIBLE">Visibles</option>
          <option value="OCULTA">Ocultas</option>
        </select>
      </div>
    </div>

    <p v-if="mensaje" class="aviso-ok">{{ mensaje }}</p>
    <p v-if="error" class="aviso-error">{{ error }}</p>

    <div class="p-card">

      <div v-if="cargando" class="bloque-cargando"><span class="spinner"></span> Cargando…</div>

      <div v-else-if="items.length === 0" class="p-vacio">
        <strong>No hay reseñas</strong>
        Prueba con otro filtro.
      </div>

      <div v-else class="p-scroll">
        <table class="p-tabla">
          <thead>
            <tr><th>Publicación</th><th>Autor</th><th>Calificación</th><th>Comentario</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="r in items" :key="r.id_calificacion">
              <td>{{ r.servicio_titulo }}<span class="sub">{{ fechaCorta(r.fecha) }}</span></td>
              <td>{{ r.autor }}</td>
              <td class="estrellas">{{ '★'.repeat(r.puntuacion) }}<i>{{ '★'.repeat(5 - r.puntuacion) }}</i></td>
              <td class="comentario">{{ r.comentario || '—' }}</td>
              <td><span class="p-badge" :class="r.estado === 'VISIBLE' ? 'ok' : 'mal'">{{ r.estado === 'VISIBLE' ? 'Visible' : 'Oculta' }}</span></td>
              <td>
                <div class="acciones">
                  <button v-if="r.estado === 'OCULTA'" class="p-btn sec peq" :disabled="trabajando === r.id_calificacion" @click="restaurar(r)">Restaurar</button>
                  <button v-else class="p-btn sec peq" @click="abrir(r, 'ocultar')">Ocultar</button>
                  <button class="p-btn mal peq" @click="abrir(r, 'eliminar')">Eliminar</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Paginacion :pagina="pagina" :total-paginas="totalPaginas" :cargando="cargando" @cambiar="irAPagina" />

    </div>

    <MotivoModal
      :abierto="Boolean(objetivo)"
      :titulo="accion === 'ocultar' ? 'Ocultar reseña' : 'Eliminar reseña'"
      :mensaje="accion === 'ocultar'
        ? 'La reseña dejará de verse y no contará en el promedio. Se avisará a su autor con el motivo.'
        : 'La reseña se eliminará definitivamente y el promedio se recalculará. Se avisará a su autor.'"
      :texto-confirmar="accion === 'ocultar' ? 'Ocultar' : 'Eliminar'"
      peligro
      :cargando="procesando"
      :error="errorModal"
      @confirmar="confirmar"
      @cancelar="objetivo = null"
    />

  </PanelLayout>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'

import PanelLayout from '../../components/PanelLayout.vue'
import Paginacion from '../../components/Paginacion.vue'
import MotivoModal from '../../components/MotivoModal.vue'
import { listarResenasAdmin, ocultarResena, restaurarResena, eliminarResenaAdmin } from '../../services/admin'
import { mensajeError } from '../../services/api'
import { fechaCorta } from '../../utils/formato'

const estado = ref('')
const items = ref([])
const pagina = ref(1)
const totalPaginas = ref(1)
const cargando = ref(true)
const error = ref('')
const mensaje = ref('')
const trabajando = ref(null)

async function cargar() {
  cargando.value = true
  error.value = ''

  try {
    const r = await listarResenasAdmin({ estado: estado.value, page: pagina.value, limit: 15 })
    items.value = r.data
    totalPaginas.value = r.meta.total_pages
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos cargar las reseñas.')
  } finally {
    cargando.value = false
  }
}

function irAPagina(n) {
  pagina.value = n
  cargar()
}

watch(estado, () => {
  pagina.value = 1
  cargar()
})

onMounted(cargar)

async function restaurar(r) {
  trabajando.value = r.id_calificacion
  mensaje.value = ''
  error.value = ''

  try {
    await restaurarResena(r.id_calificacion)
    mensaje.value = 'La reseña volvió a estar visible.'
    await cargar()
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos restaurar la reseña.')
  } finally {
    trabajando.value = null
  }
}

const objetivo = ref(null)
const accion = ref('ocultar')
const procesando = ref(false)
const errorModal = ref('')

function abrir(r, tipo) {
  objetivo.value = r
  accion.value = tipo
  errorModal.value = ''
}

async function confirmar(motivo) {
  procesando.value = true
  errorModal.value = ''
  mensaje.value = ''

  try {
    if (accion.value === 'ocultar') {
      await ocultarResena(objetivo.value.id_calificacion, motivo)
      mensaje.value = 'La reseña fue ocultada.'
    } else {
      await eliminarResenaAdmin(objetivo.value.id_calificacion, motivo)
      mensaje.value = 'La reseña fue eliminada.'
    }

    objetivo.value = null
    await cargar()
  } catch (e) {
    errorModal.value = mensajeError(e, 'No pudimos completar la acción.')
  } finally {
    procesando.value = false
  }
}
</script>

<style scoped>
.estrellas { color: #d99a1f; white-space: nowrap; letter-spacing: 1px; }
.estrellas i { font-style: normal; color: #dcdad0; }
.comentario { max-width: 320px; line-height: 1.45; }
</style>
