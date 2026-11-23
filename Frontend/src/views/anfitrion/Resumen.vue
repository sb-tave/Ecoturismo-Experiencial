<template>
  <PanelLayout
    :titulo="`Hola, ${primerNombre}`"
    subtitulo="Así va tu actividad en Raíz."
  >

    <template #acciones>
      <router-link class="p-btn" to="/anfitrion/publicaciones/nueva">+ Nueva publicación</router-link>
    </template>

    <div v-if="cargando" class="bloque-cargando"><span class="spinner"></span> Cargando…</div>

    <p v-else-if="error" class="aviso-error">{{ error }} <button @click="cargar">Reintentar</button></p>

    <template v-else>

      <div class="p-grid">

        <div class="p-stat">
          <span>Publicaciones activas</span>
          <strong>{{ conteo.ACTIVO }}</strong>
          <small>de {{ totalPublicaciones }} en total</small>
        </div>

        <div class="p-stat" :class="{ alerta: conteo.OCULTO > 0 }">
          <span>Ocultas por moderación</span>
          <strong>{{ conteo.OCULTO }}</strong>
          <small>{{ conteo.OCULTO > 0 ? 'Revisa tus notificaciones' : 'Todo en orden' }}</small>
        </div>

        <div class="p-stat">
          <span>Calificación promedio</span>
          <strong>{{ promedio ? promedio.toFixed(1) + ' ★' : '—' }}</strong>
          <small>{{ totalResenas }} reseñas</small>
        </div>

        <template v-if="esAnfitrion">

          <div class="p-stat">
            <span>Reservas confirmadas</span>
            <strong>{{ reservas.CONFIRMADA }}</strong>
            <small>próximas a ocurrir</small>
          </div>

          <div class="p-stat" :class="{ alerta: reservas.PENDIENTE_PAGO > 0 }">
            <span>Esperando pago</span>
            <strong>{{ reservas.PENDIENTE_PAGO }}</strong>
            <small>el cupo se libera si no pagan</small>
          </div>

          <div class="p-stat">
            <span>Experiencias realizadas</span>
            <strong>{{ reservas.COMPLETADA }}</strong>
          </div>

        </template>

      </div>

      <p v-if="totalPublicaciones === 0" class="aviso-info">
        Aún no tienes publicaciones. Crea la primera para empezar a recibir
        {{ esAnfitrion ? 'reservas' : 'visitas' }}.
      </p>

      <section v-if="esAnfitrion" class="p-card">

        <h2>Próximas reservas confirmadas</h2>

        <div v-if="proximas.length === 0" class="p-vacio">
          <strong>Sin reservas por ahora</strong>
          Cuando alguien pague una reserva, aparecerá aquí.
        </div>

        <div v-else class="p-scroll">
          <table class="p-tabla">
            <thead>
              <tr><th>Código</th><th>Experiencia</th><th>Turista</th><th>Fechas</th><th>Personas</th><th class="num">Total</th></tr>
            </thead>
            <tbody>
              <tr v-for="r in proximas" :key="r.id_reserva">
                <td>{{ r.codigo }}</td>
                <td>{{ r.servicio.titulo }}</td>
                <td>{{ r.turista.nombre }}</td>
                <td>{{ rango(r) }}</td>
                <td>{{ r.num_personas }}</td>
                <td class="num">{{ dinero(r.precio_total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

      </section>

    </template>

  </PanelLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

import PanelLayout from '../../components/PanelLayout.vue'
import { listarMisServicios } from '../../services/anfitrion'
import { listarReservas } from '../../services/reservas'
import { sesion } from '../../services/auth'
import { mensajeError } from '../../services/api'
import { dinero, fechaCorta } from '../../utils/formato'

const primerNombre = computed(() => (sesion.usuario?.nombre || '').split(' ')[0])
const esAnfitrion = computed(() => sesion.usuario?.rol === 'ANFITRION')

const cargando = ref(true)
const error = ref('')

const conteo = reactive({ ACTIVO: 0, INACTIVO: 0, OCULTO: 0 })
const totalPublicaciones = ref(0)
const promedio = ref(null)
const totalResenas = ref(0)

const reservas = reactive({ PENDIENTE_PAGO: 0, CONFIRMADA: 0, COMPLETADA: 0 })
const proximas = ref([])

const rango = (r) => (r.fecha_inicio === r.fecha_fin ? fechaCorta(r.fecha_inicio) : `${fechaCorta(r.fecha_inicio)} → ${fechaCorta(r.fecha_fin)}`)

async function cargar() {
  cargando.value = true
  error.value = ''

  try {
    const mias = await listarMisServicios({ limit: 50 })

    totalPublicaciones.value = mias.meta.total
    Object.assign(conteo, { ACTIVO: 0, INACTIVO: 0, OCULTO: 0 })
    mias.data.forEach((s) => { conteo[s.estado] += 1 })

    const conNota = mias.data.filter((s) => s.promedio_calificacion != null)
    promedio.value = conNota.length ? conNota.reduce((a, s) => a + s.promedio_calificacion, 0) / conNota.length : null
    totalResenas.value = mias.data.reduce((a, s) => a + (s.total_calificaciones || 0), 0)

    if (esAnfitrion.value) {
      const [pendientes, confirmadas, completadas] = await Promise.all([
        listarReservas({ estado: 'PENDIENTE_PAGO', limit: 1 }),
        listarReservas({ estado: 'CONFIRMADA', limit: 5 }),
        listarReservas({ estado: 'COMPLETADA', limit: 1 })
      ])

      reservas.PENDIENTE_PAGO = pendientes.meta.total
      reservas.CONFIRMADA = confirmadas.meta.total
      reservas.COMPLETADA = completadas.meta.total
      proximas.value = confirmadas.data
    }
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos cargar tu resumen.')
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)
</script>
