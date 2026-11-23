<template>
  <PanelLayout
    titulo="Disponibilidad"
    :subtitulo="servicio ? servicio.titulo : ''"
  >

    <template #acciones>
      <router-link class="p-btn sec" :to="`/anfitrion/publicaciones/${idServicio}`">← Volver a la publicación</router-link>
    </template>

    <div v-if="cargando" class="bloque-cargando"><span class="spinner"></span> Cargando…</div>

    <p v-else-if="errorCarga" class="aviso-error">{{ errorCarga }} <button @click="iniciar">Reintentar</button></p>

    <template v-else>

      <p class="aviso-info">
        {{ servicio.tipo === 'ALOJAMIENTO'
          ? 'En un alojamiento cada noche consume 1 cupo (el día de salida no cuenta). Por ejemplo, con 1 cupo la cabaña se reserva una sola vez por noche.'
          : 'En una actividad cada persona consume 1 cupo por día. Por ejemplo, 12 cupos permiten hasta 12 personas ese día.' }}
        Los días sin registro no se pueden reservar.
      </p>

      <div class="dos-columnas">

        <!-- DEFINIR CUPOS -->
        <form class="p-card" @submit.prevent="definir" novalidate>

          <h2>Definir cupos</h2>
          <p class="ayuda">Aplica la misma cantidad de cupos a todos los días del periodo (máximo 366 días). No puede quedar por debajo de lo ya reservado.</p>

          <div class="p-form-grid">

            <div class="p-campo">
              <label for="d-desde">Desde</label>
              <input id="d-desde" class="p-input" type="date" :min="hoy" v-model="def.desde">
            </div>

            <div class="p-campo">
              <label for="d-hasta">Hasta</label>
              <input id="d-hasta" class="p-input" type="date" :min="def.desde || hoy" v-model="def.hasta">
            </div>

            <div class="p-campo ancho">
              <label for="d-cupos">Cupos por día</label>
              <input id="d-cupos" class="p-input" type="number" min="1" max="1000" v-model="def.cupos">
            </div>

          </div>

          <p v-if="errorDef" class="aviso-error">{{ errorDef }}</p>
          <p v-if="exitoDef" class="aviso-ok">{{ exitoDef }}</p>

          <div class="p-acciones">
            <button type="submit" class="p-btn" :disabled="definiendo">
              <span v-if="definiendo" class="spinner blanco"></span>
              Guardar cupos
            </button>
          </div>

        </form>

        <!-- BLOQUEAR DÍAS -->
        <form class="p-card" @submit.prevent="bloquear" novalidate>

          <h2>Bloquear días</h2>
          <p class="ayuda">Cierra días (mantenimiento, vacaciones). Solo se bloquean los días sin reservas; los que ya tienen reservas se te informan.</p>

          <div class="p-form-grid">

            <div class="p-campo">
              <label for="b-desde">Desde</label>
              <input id="b-desde" class="p-input" type="date" :min="hoy" v-model="blo.desde">
            </div>

            <div class="p-campo">
              <label for="b-hasta">Hasta</label>
              <input id="b-hasta" class="p-input" type="date" :min="blo.desde || hoy" v-model="blo.hasta">
            </div>

          </div>

          <p v-if="errorBlo" class="aviso-error">{{ errorBlo }}</p>
          <p v-if="exitoBlo" class="aviso-ok">{{ exitoBlo }}</p>

          <div class="p-acciones">
            <button type="submit" class="p-btn mal" :disabled="bloqueando">
              <span v-if="bloqueando" class="spinner"></span>
              Bloquear días
            </button>
          </div>

        </form>

      </div>

      <!-- CALENDARIO ACTUAL -->
      <section class="p-card">

        <h2>Cupos registrados</h2>

        <div class="p-filtros">
          <div class="campo">
            <label for="v-desde">Ver desde</label>
            <input id="v-desde" class="p-input" type="date" v-model="ver.desde">
          </div>

          <div class="campo">
            <label for="v-hasta">Hasta</label>
            <input id="v-hasta" class="p-input" type="date" :min="ver.desde" v-model="ver.hasta">
          </div>

          <button class="p-btn sec" :disabled="cargandoDias" @click="cargarDias">Consultar</button>
        </div>

        <p v-if="errorDias" class="aviso-error">{{ errorDias }}</p>

        <div v-if="cargandoDias" class="bloque-cargando"><span class="spinner"></span> Consultando…</div>

        <div v-else-if="dias.length === 0" class="p-vacio">
          <strong>Sin cupos en este periodo</strong>
          Define cupos arriba para que los turistas puedan reservar.
        </div>

        <div v-else class="p-scroll">
          <table class="p-tabla">
            <thead>
              <tr><th>Fecha</th><th class="num">Cupos totales</th><th class="num">Reservados</th><th class="num">Disponibles</th><th>Estado</th></tr>
            </thead>
            <tbody>
              <tr v-for="d in dias" :key="d.fecha">
                <td>{{ fechaLarga(d.fecha) }}</td>
                <td class="num">{{ d.cupos_totales }}</td>
                <td class="num">{{ d.cupos_totales - d.cupos_disponibles }}</td>
                <td class="num">{{ d.cupos_disponibles }}</td>
                <td>
                  <span class="p-badge" :class="estadoDia(d).clase">{{ estadoDia(d).texto }}</span>
                </td>
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
import { useRoute, useRouter } from 'vue-router'

import PanelLayout from '../../components/PanelLayout.vue'
import { detalleServicio, definirDisponibilidad, bloquearFechas } from '../../services/anfitrion'
import { obtenerDisponibilidad } from '../../services/destinos'
import { mensajeError, codigoError, detallesError } from '../../services/api'
import { aISO, sumarDias, fechaLarga, fechaCorta } from '../../utils/formato'

const route = useRoute()
const router = useRouter()

const idServicio = computed(() => Number(route.params.id))
const hoy = aISO(new Date())

const servicio = ref(null)
const cargando = ref(true)
const errorCarga = ref('')

const def = reactive({ desde: hoy, hasta: sumarDias(hoy, 29), cupos: '' })
const blo = reactive({ desde: '', hasta: '' })
const ver = reactive({ desde: hoy, hasta: sumarDias(hoy, 59) })

const dias = ref([])
const cargandoDias = ref(false)
const errorDias = ref('')

async function iniciar() {
  cargando.value = true
  errorCarga.value = ''

  try {
    servicio.value = await detalleServicio(idServicio.value)

    // Los negocios locales no tienen cupos
    if (servicio.value.tipo === 'NEGOCIO_LOCAL') {
      router.replace(`/anfitrion/publicaciones/${idServicio.value}`)
      return
    }

    // Capacidad como sugerencia de cupos
    if (!def.cupos && servicio.value.capacidad_max) def.cupos = servicio.value.capacidad_max

    await cargarDias()
  } catch (e) {
    errorCarga.value = mensajeError(e, 'No pudimos cargar la disponibilidad.')
  } finally {
    cargando.value = false
  }
}

onMounted(iniciar)

async function cargarDias() {
  cargandoDias.value = true
  errorDias.value = ''

  try {
    const r = await obtenerDisponibilidad(idServicio.value, ver.desde, ver.hasta)
    dias.value = r.dias
  } catch (e) {
    errorDias.value = mensajeError(e, 'No pudimos consultar los cupos.')
  } finally {
    cargandoDias.value = false
  }
}

function estadoDia(d) {
  if (d.cupos_totales === 0) return { texto: 'Bloqueado', clase: 'mal' }
  if (d.cupos_disponibles === 0) return { texto: 'Agotado', clase: 'warn' }
  return { texto: 'Disponible', clase: 'ok' }
}

// ---- Definir cupos ----

const definiendo = ref(false)
const errorDef = ref('')
const exitoDef = ref('')

async function definir() {
  if (definiendo.value) return

  errorDef.value = ''
  exitoDef.value = ''

  if (!def.desde || !def.hasta) { errorDef.value = 'Elige las fechas de inicio y fin.'; return }
  if (def.hasta < def.desde) { errorDef.value = 'La fecha final no puede ser anterior a la inicial.'; return }
  if (!def.cupos || Number(def.cupos) < 1) { errorDef.value = 'Indica cuántos cupos hay por día.'; return }

  definiendo.value = true

  try {
    const r = await definirDisponibilidad(idServicio.value, { desde: def.desde, hasta: def.hasta, cupos_totales: Number(def.cupos) })
    exitoDef.value = `Listo: se actualizaron ${r.dias_actualizados} días.`
    await cargarDias()
  } catch (e) {
    if (codigoError(e) === 'CUPOS_INFERIORES_A_RESERVADOS') {
      const fechas = detallesError(e)?.fechas || []
      errorDef.value = `Hay días con más cupos reservados que el nuevo total: ${fechas.map(fechaCorta).join(', ')}.`
    } else {
      errorDef.value = mensajeError(e, 'No pudimos guardar los cupos.')
    }
  } finally {
    definiendo.value = false
  }
}

// ---- Bloquear días ----

const bloqueando = ref(false)
const errorBlo = ref('')
const exitoBlo = ref('')

async function bloquear() {
  if (bloqueando.value) return

  errorBlo.value = ''
  exitoBlo.value = ''

  if (!blo.desde || !blo.hasta) { errorBlo.value = 'Elige las fechas a bloquear.'; return }
  if (blo.hasta < blo.desde) { errorBlo.value = 'La fecha final no puede ser anterior a la inicial.'; return }

  bloqueando.value = true

  try {
    const r = await bloquearFechas(idServicio.value, { desde: blo.desde, hasta: blo.hasta })

    const partes = [`Se bloquearon ${r.bloqueadas.length} día(s).`]
    if (r.con_reservas.length) {
      partes.push(`No se pudieron bloquear por tener reservas: ${r.con_reservas.map(fechaCorta).join(', ')}.`)
    }
    exitoBlo.value = partes.join(' ')

    await cargarDias()
  } catch (e) {
    errorBlo.value = mensajeError(e, 'No pudimos bloquear los días.')
  } finally {
    bloqueando.value = false
  }
}
</script>

<style scoped>
.dos-columnas {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 18px;
  align-items: start;
}
</style>
