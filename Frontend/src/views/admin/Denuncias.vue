<template>
  <PanelLayout titulo="Denuncias" subtitulo="Revisa lo que reportan los usuarios.">

    <div class="p-filtros">

      <div class="campo">
        <label for="estado">Estado</label>
        <select id="estado" class="p-select" v-model="estado">
          <option value="">Todas</option>
          <option value="PENDIENTE">Pendientes</option>
          <option value="RESUELTA">Resueltas</option>
          <option value="DESESTIMADA">Desestimadas</option>
        </select>
      </div>

      <div class="campo">
        <label for="tipo">Tipo</label>
        <select id="tipo" class="p-select" v-model="tipo">
          <option value="">Todos</option>
          <option value="PUBLICACION">Publicaciones</option>
          <option value="RESENA">Reseñas</option>
        </select>
      </div>

    </div>

    <p v-if="mensaje" class="aviso-ok">{{ mensaje }}</p>
    <p v-if="error" class="aviso-error">{{ error }}</p>

    <div v-if="cargando" class="bloque-cargando"><span class="spinner"></span> Cargando…</div>

    <div v-else-if="items.length === 0" class="p-card">
      <div class="p-vacio">
        <strong>No hay denuncias</strong>
        {{ estado === 'PENDIENTE' ? 'Todo está al día.' : 'Prueba con otro filtro.' }}
      </div>
    </div>

    <template v-else>

    <article v-for="d in items" :key="d.id_denuncia" class="p-card denuncia">

      <div class="cabecera">
        <div>
          <span class="p-badge info">{{ d.tipo === 'PUBLICACION' ? 'Publicación' : 'Reseña' }}</span>
          <span class="p-badge" :class="claseEstado[d.estado]">{{ etiquetaEstado[d.estado] }}</span>
        </div>
        <small>{{ fechaHora(d.fecha_creacion) }}</small>
      </div>

      <div class="objetivo">
        <template v-if="d.tipo === 'PUBLICACION'">
          <strong>{{ d.objetivo.titulo }}</strong>
          <small>Estado actual: {{ d.objetivo.estado }}</small>
        </template>
        <template v-else>
          <strong>{{ '★'.repeat(d.objetivo.puntuacion || 0) }}</strong>
          <p>{{ d.objetivo.comentario || 'Reseña sin comentario' }}</p>
          <small>Estado actual: {{ d.objetivo.estado }}</small>
        </template>
      </div>

      <p class="motivo"><span>Motivo:</span> {{ d.motivo }}</p>
      <small class="denunciante">Denunciado por {{ d.denunciante.nombre }}</small>

      <div v-if="d.estado === 'PENDIENTE'" class="p-acciones">
        <button class="p-btn mal" :disabled="trabajando === d.id_denuncia" @click="abrir(d, 'OCULTAR')">
          Ocultar contenido
        </button>
        <button class="p-btn sec" :disabled="trabajando === d.id_denuncia" @click="resolver(d, 'DESESTIMAR')">
          Desestimar
        </button>
      </div>

      <small v-else-if="d.fecha_resolucion" class="denunciante">Atendida el {{ fechaHora(d.fecha_resolucion) }}</small>

    </article>

    </template>

    <Paginacion :pagina="pagina" :total-paginas="totalPaginas" :cargando="cargando" @cambiar="irAPagina" />

    <ConfirmarModal
      :abierto="Boolean(porOcultar)"
      titulo="¿Ocultar el contenido denunciado?"
      mensaje="Se ocultará la publicación o reseña, la denuncia quedará como resuelta y se avisará a su autor."
      texto-confirmar="Sí, ocultar"
      peligro
      :cargando="Boolean(trabajando)"
      @confirmar="resolver(porOcultar, 'OCULTAR')"
      @cancelar="porOcultar = null"
    />

  </PanelLayout>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'

import PanelLayout from '../../components/PanelLayout.vue'
import Paginacion from '../../components/Paginacion.vue'
import ConfirmarModal from '../../components/ConfirmarModal.vue'
import { listarDenuncias, resolverDenuncia } from '../../services/admin'
import { mensajeError } from '../../services/api'
import { fechaHora } from '../../utils/formato'

const etiquetaEstado = { PENDIENTE: 'Pendiente', RESUELTA: 'Resuelta', DESESTIMADA: 'Desestimada' }
const claseEstado = { PENDIENTE: 'warn', RESUELTA: 'ok', DESESTIMADA: '' }

const estado = ref('PENDIENTE')
const tipo = ref('')
const items = ref([])
const pagina = ref(1)
const totalPaginas = ref(1)
const cargando = ref(true)
const error = ref('')
const mensaje = ref('')
const trabajando = ref(null)
const porOcultar = ref(null)

async function cargar() {
  cargando.value = true
  error.value = ''

  try {
    const r = await listarDenuncias({ estado: estado.value, tipo: tipo.value, page: pagina.value, limit: 10 })
    items.value = r.data
    totalPaginas.value = r.meta.total_pages
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos cargar las denuncias.')
  } finally {
    cargando.value = false
  }
}

function irAPagina(n) {
  pagina.value = n
  cargar()
}

watch([estado, tipo], () => {
  pagina.value = 1
  cargar()
})

onMounted(cargar)

function abrir(d, accion) {
  if (accion === 'OCULTAR') porOcultar.value = d
}

async function resolver(d, accion) {
  trabajando.value = d.id_denuncia
  error.value = ''
  mensaje.value = ''

  try {
    await resolverDenuncia(d.id_denuncia, accion)
    mensaje.value = accion === 'OCULTAR' ? 'Contenido ocultado y denuncia resuelta.' : 'Denuncia desestimada.'
    porOcultar.value = null
    await cargar()
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos atender la denuncia.')
    porOcultar.value = null
  } finally {
    trabajando.value = null
  }
}
</script>

<style scoped>
.cabecera {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.cabecera .p-badge + .p-badge { margin-left: 6px; }
.cabecera small { font-size: 11px; color: #9a9a90; }

.objetivo {
  background: #f7f6f0;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 10px;
}

.objetivo strong { display: block; font-weight: normal; font-size: 14px; color: #d99a1f; }
.objetivo p { font-size: 13px; line-height: 1.5; margin: 4px 0; color: #4d5a50; }
.objetivo small { font-size: 11px; color: #9a9a90; }

.motivo { font-size: 13px; line-height: 1.5; }
.motivo span { color: #85877e; }
.denunciante { display: block; margin-top: 6px; font-size: 11px; color: #9a9a90; }
</style>
