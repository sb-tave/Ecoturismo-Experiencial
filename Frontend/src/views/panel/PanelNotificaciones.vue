<template>
  <PanelLayout titulo="Notificaciones" subtitulo="Avisos sobre reservas, pagos y moderación.">

    <template #acciones>
      <button v-if="noLeidas > 0" class="p-btn sec" :disabled="marcando" @click="marcarTodas">
        Marcar todas como leídas
      </button>
    </template>

    <p v-if="error" class="aviso-error">{{ error }} <button @click="cargar">Reintentar</button></p>

    <div class="p-card">

      <div v-if="cargando" class="bloque-cargando"><span class="spinner"></span> Cargando…</div>

      <div v-else-if="items.length === 0" class="p-vacio">
        <strong>Todo al día</strong>
        Aquí aparecerán tus avisos.
      </div>

      <ul v-else class="lista">
        <li
          v-for="n in items"
          :key="n.id_notificacion"
          :class="{ nueva: !n.leida }"
          @click="abrir(n)"
        >
          <span class="punto" :class="{ activo: !n.leida }"></span>

          <div>
            <strong>{{ TITULOS[n.tipo] || 'Aviso' }}</strong>
            <p>{{ n.mensaje }}</p>
            <small>{{ fechaHora(n.fecha_envio) }}</small>
          </div>
        </li>
      </ul>

      <button
        v-if="pagina < totalPaginas"
        class="p-btn sec"
        style="margin: 14px auto 0"
        :disabled="cargandoMas"
        @click="cargarMas"
      >
        {{ cargandoMas ? 'Cargando…' : 'Ver más' }}
      </button>

    </div>

  </PanelLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'

import PanelLayout from '../../components/PanelLayout.vue'
import { listarNotificaciones, marcarLeida, marcarTodasLeidas } from '../../services/notificaciones'
import { mensajeError } from '../../services/api'
import { fechaHora } from '../../utils/formato'

const TITULOS = {
  NUEVA_RESERVA: 'Nueva reserva confirmada',
  PAGO_APROBADO: 'Pago aprobado',
  RESERVA_CANCELADA: 'Reserva cancelada',
  NUEVA_CALIFICACION: 'Nueva calificación',
  CONTENIDO_MODERADO: 'Moderación de contenido'
}

const items = ref([])
const pagina = ref(1)
const totalPaginas = ref(1)
const noLeidas = ref(0)
const cargando = ref(true)
const cargandoMas = ref(false)
const marcando = ref(false)
const error = ref('')

async function cargar() {
  cargando.value = true
  error.value = ''

  try {
    const r = await listarNotificaciones({ page: 1, limit: 20 })
    items.value = r.data
    pagina.value = 1
    totalPaginas.value = r.meta.total_pages
    noLeidas.value = r.meta.no_leidas
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos cargar las notificaciones.')
  } finally {
    cargando.value = false
  }
}

async function cargarMas() {
  cargandoMas.value = true

  try {
    const r = await listarNotificaciones({ page: pagina.value + 1, limit: 20 })
    items.value = [...items.value, ...r.data]
    pagina.value += 1
    totalPaginas.value = r.meta.total_pages
  } catch (e) {
    error.value = mensajeError(e)
  } finally {
    cargandoMas.value = false
  }
}

async function abrir(n) {
  if (n.leida) return

  try {
    await marcarLeida(n.id_notificacion)
    n.leida = true
    noLeidas.value = Math.max(0, noLeidas.value - 1)
  } catch {
    // Se mantiene como no leída
  }
}

async function marcarTodas() {
  marcando.value = true

  try {
    await marcarTodasLeidas()
    items.value.forEach((n) => { n.leida = true })
    noLeidas.value = 0
  } catch (e) {
    error.value = mensajeError(e)
  } finally {
    marcando.value = false
  }
}

onMounted(cargar)
</script>

<style scoped>
.lista { list-style: none; }

.lista li {
  display: flex;
  gap: 12px;
  padding: 14px 6px;
  border-top: 1px solid #f0eee6;
  cursor: pointer;
}

.lista li:first-child { border-top: none; }
.lista li.nueva { background: #f6faf3; }

.lista strong { font-size: 13px; }
.lista p { font-size: 13px; line-height: 1.5; color: #55604f; margin: 3px 0; }
.lista small { font-size: 11px; color: #9a9a90; }

.punto {
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: transparent;
}

.punto.activo { background: #c0463f; }
</style>
