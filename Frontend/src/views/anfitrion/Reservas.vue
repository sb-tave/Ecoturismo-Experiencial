<template>
  <PanelLayout titulo="Reservas recibidas" subtitulo="Las reservas de tus alojamientos y actividades.">

    <div class="p-filtros">

      <div class="campo">
        <label for="estado">Estado</label>
        <select id="estado" class="p-select" v-model="estado">
          <option value="">Todos</option>
          <option v-for="(v, k) in ESTADOS_RESERVA" :key="k" :value="k">{{ v.etiqueta }}</option>
        </select>
      </div>

      <div class="campo">
        <label for="servicio">Publicación</label>
        <select id="servicio" class="p-select" v-model="idServicio">
          <option value="">Todas</option>
          <option v-for="s in misServicios" :key="s.id_servicio" :value="s.id_servicio">{{ s.titulo }}</option>
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

      <button v-if="hayFiltros" class="p-btn sec" @click="limpiar">Limpiar</button>

    </div>

    <p v-if="error" class="aviso-error">{{ error }} <button @click="cargar">Reintentar</button></p>

    <div class="p-card">

      <div v-if="cargando" class="bloque-cargando"><span class="spinner"></span> Cargando…</div>

      <div v-else-if="items.length === 0" class="p-vacio">
        <strong>No hay reservas {{ hayFiltros ? 'con esos filtros' : 'todavía' }}</strong>
        Cuando alguien reserve una de tus publicaciones aparecerá aquí.
      </div>

      <div v-else class="p-scroll">
        <table class="p-tabla">
          <thead>
            <tr><th>Código</th><th>Experiencia</th><th>Turista</th><th>Fechas</th><th>Personas</th><th class="num">Total</th><th>Pago</th><th>Estado</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in items" :key="r.id_reserva">
              <td>{{ r.codigo }}<span class="sub">{{ fechaCorta(r.fecha_creacion) }}</span></td>
              <td>{{ r.servicio.titulo }}<span class="sub">{{ r.servicio.localidad }}</span></td>
              <td>{{ r.turista.nombre }}</td>
              <td>{{ rango(r) }}</td>
              <td>{{ r.num_personas }}</td>
              <td class="num">{{ dinero(r.precio_total) }}</td>
              <td><span class="p-badge" :class="clasePago[r.estado_pago]">{{ etiquetaPago[r.estado_pago] }}</span></td>
              <td><span class="p-badge" :class="claseEstado[r.estado]">{{ ESTADOS_RESERVA[r.estado].etiqueta }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <Paginacion :pagina="pagina" :total-paginas="totalPaginas" :cargando="cargando" @cambiar="irAPagina" />

    </div>

  </PanelLayout>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

import PanelLayout from '../../components/PanelLayout.vue'
import Paginacion from '../../components/Paginacion.vue'
import { listarReservas, ESTADOS_RESERVA } from '../../services/reservas'
import { listarMisServicios } from '../../services/anfitrion'
import { mensajeError } from '../../services/api'
import { dinero, fechaCorta } from '../../utils/formato'

const claseEstado = { PENDIENTE_PAGO: 'warn', CONFIRMADA: 'ok', COMPLETADA: 'info', CANCELADA: 'mal' }
const etiquetaPago = { APROBADO: 'Aprobado', PENDIENTE: 'Pendiente', RECHAZADO: 'Rechazado', SIN_PAGO: 'Sin pago' }
const clasePago = { APROBADO: 'ok', PENDIENTE: 'warn', RECHAZADO: 'mal', SIN_PAGO: '' }

const rango = (r) => (r.fecha_inicio === r.fecha_fin ? fechaCorta(r.fecha_inicio) : `${fechaCorta(r.fecha_inicio)} → ${fechaCorta(r.fecha_fin)}`)

const estado = ref('')
const idServicio = ref('')
const desde = ref('')
const hasta = ref('')

const misServicios = ref([])
const items = ref([])
const pagina = ref(1)
const totalPaginas = ref(1)
const cargando = ref(true)
const error = ref('')

const hayFiltros = computed(() => Boolean(estado.value || idServicio.value || desde.value || hasta.value))

async function cargar() {
  cargando.value = true
  error.value = ''

  try {
    const r = await listarReservas({
      estado: estado.value,
      id_servicio: idServicio.value,
      desde: desde.value,
      hasta: hasta.value,
      page: pagina.value,
      limit: 15
    })

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

function limpiar() {
  estado.value = ''
  idServicio.value = ''
  desde.value = ''
  hasta.value = ''
}

watch([estado, idServicio, desde, hasta], () => {
  pagina.value = 1
  cargar()
})

onMounted(async () => {
  cargar()

  try {
    const r = await listarMisServicios({ limit: 50 })
    misServicios.value = r.data.filter((s) => s.tipo !== 'NEGOCIO_LOCAL')
  } catch {
    // El filtro por publicación es opcional
  }
})
</script>
