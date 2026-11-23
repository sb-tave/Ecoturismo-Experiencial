<template>
  <PanelLayout titulo="Reservas" subtitulo="Todas las reservas de la plataforma.">

    <div class="p-filtros">

      <div class="campo">
        <label for="estado">Estado</label>
        <select id="estado" class="p-select" v-model="estado">
          <option value="">Todos</option>
          <option v-for="(v, k) in ESTADOS_RESERVA" :key="k" :value="k">{{ v.etiqueta }}</option>
        </select>
      </div>

      <div class="campo">
        <label for="desde">Inicio desde</label>
        <input id="desde" class="p-input" type="date" v-model="desde">
      </div>

      <div class="campo">
        <label for="hasta">Inicio hasta</label>
        <input id="hasta" class="p-input" type="date" :min="desde" v-model="hasta">
      </div>

    </div>

    <p v-if="mensaje" class="aviso-ok">{{ mensaje }}</p>
    <p v-if="error" class="aviso-error">{{ error }}</p>

    <div class="p-card">

      <div v-if="cargando" class="bloque-cargando"><span class="spinner"></span> Cargando…</div>

      <div v-else-if="items.length === 0" class="p-vacio">
        <strong>No hay reservas</strong>
        Prueba con otros filtros.
      </div>

      <div v-else class="p-scroll">
        <table class="p-tabla">
          <thead>
            <tr><th>Código</th><th>Experiencia</th><th>Turista</th><th>Fechas</th><th>Pers.</th><th class="num">Total</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="r in items" :key="r.id_reserva">
              <td>{{ r.codigo }}<span class="sub">{{ fechaCorta(r.fecha_creacion) }}</span></td>
              <td>{{ r.servicio.titulo }}<span class="sub">{{ r.servicio.localidad }}</span></td>
              <td>{{ r.turista?.nombre }}</td>
              <td>{{ rango(r) }}</td>
              <td>{{ r.num_personas }}</td>
              <td class="num">{{ dinero(r.precio_total) }}</td>
              <td><span class="p-badge" :class="claseEstado[r.estado]">{{ ESTADOS_RESERVA[r.estado].etiqueta }}</span></td>
              <td>
                <div class="acciones">
                  <button
                    v-if="['PENDIENTE_PAGO', 'CONFIRMADA'].includes(r.estado)"
                    class="p-btn mal peq"
                    @click="abrir(r)"
                  >
                    Cancelar
                  </button>
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
      titulo="Cancelar reserva"
      :mensaje="`Se cancelará la reserva ${objetivo?.codigo}, se liberará el cupo y se avisará al turista y al anfitrión.`"
      texto-confirmar="Cancelar reserva"
      :obligatorio="false"
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
import { listarReservas, cancelarReserva, ESTADOS_RESERVA } from '../../services/reservas'
import { mensajeError } from '../../services/api'
import { dinero, fechaCorta } from '../../utils/formato'

const claseEstado = { PENDIENTE_PAGO: 'warn', CONFIRMADA: 'ok', COMPLETADA: 'info', CANCELADA: 'mal' }
const rango = (r) => (r.fecha_inicio === r.fecha_fin ? fechaCorta(r.fecha_inicio) : `${fechaCorta(r.fecha_inicio)} → ${fechaCorta(r.fecha_fin)}`)

const estado = ref('')
const desde = ref('')
const hasta = ref('')
const items = ref([])
const pagina = ref(1)
const totalPaginas = ref(1)
const cargando = ref(true)
const error = ref('')
const mensaje = ref('')

async function cargar() {
  cargando.value = true
  error.value = ''

  try {
    const r = await listarReservas({ estado: estado.value, desde: desde.value, hasta: hasta.value, page: pagina.value, limit: 15 })
    items.value = r.data
    totalPaginas.value = r.meta.total_pages
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos cargar las reservas.')
  } finally {
    cargando.value = false
  }
}

function irAPagina(n) {
  pagina.value = n
  cargar()
}

watch([estado, desde, hasta], () => {
  pagina.value = 1
  cargar()
})

onMounted(cargar)

const objetivo = ref(null)
const procesando = ref(false)
const errorModal = ref('')

function abrir(r) {
  objetivo.value = r
  errorModal.value = ''
}

async function confirmar(motivo) {
  procesando.value = true
  errorModal.value = ''
  mensaje.value = ''

  try {
    await cancelarReserva(objetivo.value.id_reserva, motivo)
    mensaje.value = `La reserva ${objetivo.value.codigo} fue cancelada.`
    objetivo.value = null
    await cargar()
  } catch (e) {
    errorModal.value = mensajeError(e, 'No pudimos cancelar la reserva.')
  } finally {
    procesando.value = false
  }
}
</script>
