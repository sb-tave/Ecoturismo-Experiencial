<template>
  <PanelLayout titulo="Publicaciones" subtitulo="Modera alojamientos, actividades y negocios locales.">

    <div class="p-filtros">

      <div class="campo">
        <label for="q">Buscar</label>
        <input id="q" class="p-input" type="search" v-model="q" placeholder="Título o localidad">
      </div>

      <div class="campo">
        <label for="estado">Estado</label>
        <select id="estado" class="p-select" v-model="estado">
          <option value="">Todos</option>
          <option value="ACTIVO">Activas</option>
          <option value="INACTIVO">Inactivas</option>
          <option value="OCULTO">Ocultas</option>
        </select>
      </div>

    </div>

    <p v-if="mensaje" class="aviso-ok">{{ mensaje }}</p>
    <p v-if="error" class="aviso-error">{{ error }}</p>

    <div class="p-card">

      <div v-if="cargando" class="bloque-cargando"><span class="spinner"></span> Cargando…</div>

      <div v-else-if="items.length === 0" class="p-vacio">
        <strong>No hay publicaciones</strong>
        Prueba con otros filtros.
      </div>

      <div v-else class="p-scroll">
        <table class="p-tabla">
          <thead>
            <tr><th>Publicación</th><th>Tipo</th><th>Anfitrión</th><th>Estado</th><th>Creada</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="s in items" :key="s.id_servicio">
              <td>{{ s.titulo }}<span class="sub">{{ s.localidad }}</span></td>
              <td>{{ TIPOS[s.tipo]?.etiqueta }}</td>
              <td>{{ s.anfitrion_nombre }}</td>
              <td><span class="p-badge" :class="claseEstado[s.estado]">{{ etiquetaEstado[s.estado] }}</span></td>
              <td>{{ fechaCorta(s.fecha_creacion) }}</td>
              <td>
                <div class="acciones">
                  <button v-if="s.estado === 'OCULTO'" class="p-btn sec peq" :disabled="trabajando === s.id_servicio" @click="restaurar(s)">Restaurar</button>
                  <button v-else class="p-btn sec peq" @click="abrir(s, 'ocultar')">Ocultar</button>
                  <button class="p-btn mal peq" @click="abrir(s, 'eliminar')">Eliminar</button>
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
      :titulo="accion === 'ocultar' ? 'Ocultar publicación' : 'Eliminar publicación'"
      :mensaje="accion === 'ocultar'
        ? `«${objetivo?.titulo}» dejará de verse en el catálogo. Se avisará al anfitrión con el motivo.`
        : `«${objetivo?.titulo}» se eliminará. Si tiene reservas, solo se ocultará. Se avisará al anfitrión.`"
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
import { listarServiciosAdmin, ocultarServicio, restaurarServicio, eliminarServicioAdmin } from '../../services/admin'
import { TIPOS } from '../../services/destinos'
import { mensajeError } from '../../services/api'
import { fechaCorta } from '../../utils/formato'

const etiquetaEstado = { ACTIVO: 'Activa', INACTIVO: 'Inactiva', OCULTO: 'Oculta' }
const claseEstado = { ACTIVO: 'ok', INACTIVO: '', OCULTO: 'mal' }

const q = ref('')
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
    const r = await listarServiciosAdmin({ q: q.value.trim(), estado: estado.value, page: pagina.value, limit: 15 })
    items.value = r.data
    totalPaginas.value = r.meta.total_pages
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos cargar las publicaciones.')
  } finally {
    cargando.value = false
  }
}

function irAPagina(n) {
  pagina.value = n
  cargar()
}

let temporizador = null

watch(q, () => {
  clearTimeout(temporizador)
  temporizador = setTimeout(() => { pagina.value = 1; cargar() }, 400)
})

watch(estado, () => {
  pagina.value = 1
  cargar()
})

onMounted(cargar)

async function restaurar(s) {
  trabajando.value = s.id_servicio
  mensaje.value = ''
  error.value = ''

  try {
    await restaurarServicio(s.id_servicio)
    mensaje.value = `«${s.titulo}» volvió a estar visible.`
    await cargar()
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos restaurar la publicación.')
  } finally {
    trabajando.value = null
  }
}

const objetivo = ref(null)
const accion = ref('ocultar')
const procesando = ref(false)
const errorModal = ref('')

function abrir(s, tipo) {
  objetivo.value = s
  accion.value = tipo
  errorModal.value = ''
}

async function confirmar(motivo) {
  procesando.value = true
  errorModal.value = ''
  mensaje.value = ''

  try {
    if (accion.value === 'ocultar') {
      await ocultarServicio(objetivo.value.id_servicio, motivo)
      mensaje.value = `«${objetivo.value.titulo}» fue ocultada.`
    } else {
      const r = await eliminarServicioAdmin(objetivo.value.id_servicio, motivo)
      mensaje.value = r.mensaje
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
