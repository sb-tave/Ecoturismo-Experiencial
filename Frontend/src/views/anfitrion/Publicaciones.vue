<template>
  <PanelLayout titulo="Mis publicaciones" subtitulo="Crea, edita y administra lo que ofreces.">

    <template #acciones>
      <router-link class="p-btn" to="/anfitrion/publicaciones/nueva">+ Nueva publicación</router-link>
    </template>

    <div class="p-filtros">
      <div class="campo">
        <label for="estado">Estado</label>
        <select id="estado" class="p-select" v-model="estado">
          <option value="">Todos</option>
          <option value="ACTIVO">Activas</option>
          <option value="INACTIVO">Inactivas</option>
          <option value="OCULTO">Ocultas por moderación</option>
        </select>
      </div>
    </div>

    <p v-if="mensaje" class="aviso-ok">{{ mensaje }}</p>
    <p v-if="error" class="aviso-error">{{ error }}</p>

    <div class="p-card">

      <div v-if="cargando" class="bloque-cargando"><span class="spinner"></span> Cargando…</div>

      <div v-else-if="items.length === 0" class="p-vacio">
        <strong>No hay publicaciones {{ estado ? 'con ese estado' : 'todavía' }}</strong>
        Crea una nueva para que los turistas puedan encontrarla.
      </div>

      <div v-else class="p-scroll">
        <table class="p-tabla">
          <thead>
            <tr><th>Publicación</th><th>Tipo</th><th>Precio</th><th>Calificación</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="s in items" :key="s.id_servicio">

              <td>
                <div class="celda-titulo">
                  <img class="mini" :src="s.foto_principal || sinFoto" alt="">
                  <div>
                    {{ s.titulo }}
                    <span class="sub">{{ s.localidad }} · {{ s.categoria }}</span>
                  </div>
                </div>
              </td>

              <td>{{ TIPOS[s.tipo]?.etiqueta }}</td>

              <td>
                <template v-if="s.precio_base != null">
                  {{ dinero(s.precio_base) }}
                  <span class="sub">/ {{ TIPOS[s.tipo]?.unidad }}</span>
                </template>
                <template v-else>—</template>
              </td>

              <td>{{ s.promedio_calificacion ? '★ ' + Number(s.promedio_calificacion).toFixed(1) : '—' }}
                <span class="sub">{{ s.total_calificaciones }} reseñas</span>
              </td>

              <td><span class="p-badge" :class="claseEstado[s.estado]">{{ etiquetaEstado[s.estado] }}</span></td>

              <td>
                <div class="acciones">
                  <router-link class="p-btn sec peq" :to="`/anfitrion/publicaciones/${s.id_servicio}`">Editar</router-link>

                  <router-link
                    v-if="esAnfitrion && s.tipo !== 'NEGOCIO_LOCAL'"
                    class="p-btn sec peq"
                    :to="`/anfitrion/publicaciones/${s.id_servicio}/disponibilidad`"
                  >
                    Disponibilidad
                  </router-link>

                  <button
                    v-if="s.estado !== 'OCULTO'"
                    class="p-btn sec peq"
                    :disabled="trabajando === s.id_servicio"
                    @click="alternarEstado(s)"
                  >
                    {{ s.estado === 'ACTIVO' ? 'Desactivar' : 'Activar' }}
                  </button>

                  <button class="p-btn mal peq" @click="porEliminar = s">Eliminar</button>
                </div>
              </td>

            </tr>
          </tbody>
        </table>
      </div>

      <Paginacion :pagina="pagina" :total-paginas="totalPaginas" :cargando="cargando" @cambiar="irAPagina" />

    </div>

    <ConfirmarModal
      :abierto="Boolean(porEliminar)"
      titulo="¿Eliminar esta publicación?"
      :mensaje="`«${porEliminar?.titulo}» se eliminará. Si ya tiene reservas no se puede borrar: en ese caso se desactiva.`"
      texto-confirmar="Sí, eliminar"
      peligro
      :cargando="eliminando"
      @confirmar="eliminar"
      @cancelar="porEliminar = null"
    />

  </PanelLayout>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

import PanelLayout from '../../components/PanelLayout.vue'
import Paginacion from '../../components/Paginacion.vue'
import ConfirmarModal from '../../components/ConfirmarModal.vue'
import { listarMisServicios, actualizarServicio, eliminarServicio } from '../../services/anfitrion'
import { TIPOS } from '../../services/destinos'
import { sesion } from '../../services/auth'
import { mensajeError } from '../../services/api'
import { dinero } from '../../utils/formato'
import sinFoto from '../../assets/hero.png'

const esAnfitrion = computed(() => sesion.usuario?.rol === 'ANFITRION')

const etiquetaEstado = { ACTIVO: 'Activa', INACTIVO: 'Inactiva', OCULTO: 'Oculta por moderación' }
const claseEstado = { ACTIVO: 'ok', INACTIVO: '', OCULTO: 'mal' }

const items = ref([])
const estado = ref('')
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
    const r = await listarMisServicios({ estado: estado.value, page: pagina.value, limit: 10 })
    items.value = r.data
    totalPaginas.value = r.meta.total_pages
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos cargar tus publicaciones.')
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

async function alternarEstado(s) {
  trabajando.value = s.id_servicio
  mensaje.value = ''
  error.value = ''

  try {
    await actualizarServicio(s.id_servicio, { estado: s.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' })
    await cargar()
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos cambiar el estado.')
  } finally {
    trabajando.value = null
  }
}

const porEliminar = ref(null)
const eliminando = ref(false)

async function eliminar() {
  eliminando.value = true
  mensaje.value = ''
  error.value = ''

  try {
    const r = await eliminarServicio(porEliminar.value.id_servicio)
    mensaje.value = r.mensaje
    porEliminar.value = null
    await cargar()
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos eliminar la publicación.')
    porEliminar.value = null
  } finally {
    eliminando.value = false
  }
}
</script>
