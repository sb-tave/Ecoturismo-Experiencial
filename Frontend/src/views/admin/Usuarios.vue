<template>
  <PanelLayout titulo="Usuarios" subtitulo="Suspende o reactiva cuentas.">

    <div class="p-filtros">

      <div class="campo">
        <label for="q">Buscar</label>
        <input id="q" class="p-input" type="search" v-model="q" placeholder="Nombre o correo">
      </div>

      <div class="campo">
        <label for="rol">Rol</label>
        <select id="rol" class="p-select" v-model="rol">
          <option value="">Todos</option>
          <option v-for="(etiqueta, clave) in ROLES" :key="clave" :value="clave">{{ etiqueta }}</option>
        </select>
      </div>

      <div class="campo">
        <label for="estado">Estado</label>
        <select id="estado" class="p-select" v-model="estado">
          <option value="">Todos</option>
          <option value="ACTIVO">Activos</option>
          <option value="SUSPENDIDO">Suspendidos</option>
          <option value="ELIMINADO">Eliminados</option>
        </select>
      </div>

    </div>

    <p v-if="mensaje" class="aviso-ok">{{ mensaje }}</p>
    <p v-if="error" class="aviso-error">{{ error }}</p>

    <div class="p-card">

      <div v-if="cargando" class="bloque-cargando"><span class="spinner"></span> Cargando…</div>

      <div v-else-if="items.length === 0" class="p-vacio">
        <strong>No se encontraron usuarios</strong>
        Prueba con otros filtros.
      </div>

      <div v-else class="p-scroll">
        <table class="p-tabla">
          <thead>
            <tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Registro</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="u in items" :key="u.id_usuario">
              <td>{{ u.nombre }}<span class="sub">{{ u.correo }}<template v-if="u.telefono"> · {{ u.telefono }}</template></span></td>
              <td>{{ ROLES[u.rol] }}</td>
              <td><span class="p-badge" :class="claseEstado[u.estado]">{{ etiquetaEstado[u.estado] }}</span></td>
              <td>{{ fechaCorta(u.fecha_registro) }}</td>
              <td>
                <div class="acciones">
                  <button v-if="puedeGestionar(u) && u.estado === 'ACTIVO'" class="p-btn mal peq" @click="porSuspender = u">Suspender</button>
                  <button v-if="puedeGestionar(u) && u.estado === 'SUSPENDIDO'" class="p-btn sec peq" :disabled="trabajando === u.id_usuario" @click="reactivar(u)">Reactivar</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Paginacion :pagina="pagina" :total-paginas="totalPaginas" :cargando="cargando" @cambiar="irAPagina" />

    </div>

    <ConfirmarModal
      :abierto="Boolean(porSuspender)"
      titulo="¿Suspender esta cuenta?"
      :mensaje="`${porSuspender?.nombre} no podrá iniciar sesión ni publicar hasta que la reactives. Sus publicaciones dejarán de verse en el catálogo.`"
      texto-confirmar="Sí, suspender"
      peligro
      :cargando="suspendiendo"
      @confirmar="suspender"
      @cancelar="porSuspender = null"
    />

  </PanelLayout>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'

import PanelLayout from '../../components/PanelLayout.vue'
import Paginacion from '../../components/Paginacion.vue'
import ConfirmarModal from '../../components/ConfirmarModal.vue'
import { listarUsuarios, cambiarEstadoUsuario } from '../../services/admin'
import { sesion, ROLES } from '../../services/auth'
import { mensajeError } from '../../services/api'
import { fechaCorta } from '../../utils/formato'

const etiquetaEstado = { ACTIVO: 'Activo', SUSPENDIDO: 'Suspendido', ELIMINADO: 'Eliminado' }
const claseEstado = { ACTIVO: 'ok', SUSPENDIDO: 'warn', ELIMINADO: '' }

const q = ref('')
const rol = ref('')
const estado = ref('')

const items = ref([])
const pagina = ref(1)
const totalPaginas = ref(1)
const cargando = ref(true)
const error = ref('')
const mensaje = ref('')
const trabajando = ref(null)

// No se puede cambiar el estado de administradores, de cuentas eliminadas ni de la propia cuenta
const puedeGestionar = (u) => u.rol !== 'ADMINISTRADOR' && u.estado !== 'ELIMINADO' && u.id_usuario !== sesion.usuario?.id_usuario

async function cargar() {
  cargando.value = true
  error.value = ''

  try {
    const r = await listarUsuarios({ q: q.value.trim(), rol: rol.value, estado: estado.value, page: pagina.value, limit: 15 })
    items.value = r.data
    totalPaginas.value = r.meta.total_pages
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos cargar los usuarios.')
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

watch([rol, estado], () => {
  pagina.value = 1
  cargar()
})

onMounted(cargar)

const porSuspender = ref(null)
const suspendiendo = ref(false)

async function cambiar(u, nuevoEstado, texto) {
  mensaje.value = ''
  error.value = ''

  try {
    await cambiarEstadoUsuario(u.id_usuario, nuevoEstado)
    mensaje.value = texto
    await cargar()
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos cambiar el estado de la cuenta.')
  }
}

async function suspender() {
  suspendiendo.value = true
  await cambiar(porSuspender.value, 'SUSPENDIDO', `Se suspendió la cuenta de ${porSuspender.value.nombre}.`)
  suspendiendo.value = false
  porSuspender.value = null
}

async function reactivar(u) {
  trabajando.value = u.id_usuario
  await cambiar(u, 'ACTIVO', `Se reactivó la cuenta de ${u.nombre}.`)
  trabajando.value = null
}
</script>
