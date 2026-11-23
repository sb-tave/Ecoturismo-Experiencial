<template>
  <PanelLayout titulo="Categorías" subtitulo="Organizan el catálogo de la plataforma.">

    <form class="p-card" @submit.prevent="crear" novalidate>

      <h2>Nueva categoría</h2>

      <div class="p-form-grid">

        <div class="p-campo">
          <label for="nombre">Nombre</label>
          <input id="nombre" class="p-input" type="text" v-model.trim="nueva.nombre" maxlength="60">
        </div>

        <div class="p-campo">
          <label for="descripcion">Descripción <small>(opcional)</small></label>
          <input id="descripcion" class="p-input" type="text" v-model.trim="nueva.descripcion" maxlength="255">
        </div>

      </div>

      <p v-if="errorNueva" class="aviso-error">{{ errorNueva }}</p>

      <div class="p-acciones">
        <button type="submit" class="p-btn" :disabled="creando">
          <span v-if="creando" class="spinner blanco"></span> Crear categoría
        </button>
      </div>

    </form>

    <p v-if="mensaje" class="aviso-ok">{{ mensaje }}</p>
    <p v-if="error" class="aviso-error">{{ error }}</p>

    <div class="p-card">

      <div v-if="cargando" class="bloque-cargando"><span class="spinner"></span> Cargando…</div>

      <div v-else-if="items.length === 0" class="p-vacio">
        <strong>No hay categorías</strong>
        Crea la primera arriba.
      </div>

      <div v-else class="p-scroll">
        <table class="p-tabla">
          <thead>
            <tr><th>Nombre</th><th>Descripción</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="c in items" :key="c.id_categoria">

              <template v-if="editando === c.id_categoria">
                <td><input class="p-input" type="text" v-model.trim="edicion.nombre" maxlength="60"></td>
                <td><input class="p-input" style="width: 100%" type="text" v-model.trim="edicion.descripcion" maxlength="255"></td>
                <td></td>
                <td>
                  <div class="acciones">
                    <button class="p-btn peq" :disabled="guardando" @click="guardar(c)">Guardar</button>
                    <button class="p-btn sec peq" @click="editando = null">Cancelar</button>
                  </div>
                </td>
              </template>

              <template v-else>
                <td>{{ c.nombre }}</td>
                <td>{{ c.descripcion || '—' }}</td>
                <td><span class="p-badge" :class="c.activa ? 'ok' : ''">{{ c.activa ? 'Activa' : 'Inactiva' }}</span></td>
                <td>
                  <div class="acciones">
                    <button class="p-btn sec peq" @click="editar(c)">Editar</button>
                    <button class="p-btn sec peq" :disabled="trabajando === c.id_categoria" @click="alternar(c)">
                      {{ c.activa ? 'Desactivar' : 'Activar' }}
                    </button>
                    <button class="p-btn mal peq" @click="porEliminar = c">Eliminar</button>
                  </div>
                </td>
              </template>

            </tr>
          </tbody>
        </table>
      </div>

    </div>

    <ConfirmarModal
      :abierto="Boolean(porEliminar)"
      titulo="¿Eliminar esta categoría?"
      :mensaje="`«${porEliminar?.nombre}» se eliminará. Si tiene publicaciones asociadas, solo se desactivará.`"
      texto-confirmar="Sí, eliminar"
      peligro
      :cargando="eliminando"
      @confirmar="eliminar"
      @cancelar="porEliminar = null"
    />

  </PanelLayout>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

import PanelLayout from '../../components/PanelLayout.vue'
import ConfirmarModal from '../../components/ConfirmarModal.vue'
import { listarCategoriasAdmin, crearCategoria, actualizarCategoria, eliminarCategoria } from '../../services/admin'
import { mensajeError } from '../../services/api'

const items = ref([])
const cargando = ref(true)
const error = ref('')
const mensaje = ref('')

async function cargar() {
  try {
    items.value = await listarCategoriasAdmin()
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos cargar las categorías.')
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)

// ---- Crear ----

const nueva = reactive({ nombre: '', descripcion: '' })
const creando = ref(false)
const errorNueva = ref('')

async function crear() {
  if (creando.value) return

  errorNueva.value = ''
  mensaje.value = ''

  if (nueva.nombre.length < 2) { errorNueva.value = 'Escribe el nombre de la categoría.'; return }

  creando.value = true

  try {
    await crearCategoria(nueva)
    nueva.nombre = ''
    nueva.descripcion = ''
    mensaje.value = 'Categoría creada.'
    await cargar()
  } catch (e) {
    errorNueva.value = mensajeError(e, 'No pudimos crear la categoría.')
  } finally {
    creando.value = false
  }
}

// ---- Editar ----

const editando = ref(null)
const edicion = reactive({ nombre: '', descripcion: '' })
const guardando = ref(false)

function editar(c) {
  editando.value = c.id_categoria
  edicion.nombre = c.nombre
  edicion.descripcion = c.descripcion || ''
}

async function guardar(c) {
  if (edicion.nombre.length < 2) { error.value = 'El nombre es obligatorio.'; return }

  guardando.value = true
  error.value = ''
  mensaje.value = ''

  try {
    await actualizarCategoria(c.id_categoria, { nombre: edicion.nombre, descripcion: edicion.descripcion || null })
    editando.value = null
    mensaje.value = 'Categoría actualizada.'
    await cargar()
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos guardar la categoría.')
  } finally {
    guardando.value = false
  }
}

// ---- Activar / desactivar ----

const trabajando = ref(null)

async function alternar(c) {
  trabajando.value = c.id_categoria
  error.value = ''
  mensaje.value = ''

  try {
    await actualizarCategoria(c.id_categoria, { activa: !c.activa })
    await cargar()
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos cambiar el estado.')
  } finally {
    trabajando.value = null
  }
}

// ---- Eliminar ----

const porEliminar = ref(null)
const eliminando = ref(false)

async function eliminar() {
  eliminando.value = true
  error.value = ''
  mensaje.value = ''

  try {
    const r = await eliminarCategoria(porEliminar.value.id_categoria)
    mensaje.value = r.mensaje
    porEliminar.value = null
    await cargar()
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos eliminar la categoría.')
    porEliminar.value = null
  } finally {
    eliminando.value = false
  }
}
</script>
