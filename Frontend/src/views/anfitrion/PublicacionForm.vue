<template>
  <PanelLayout
    :titulo="editando ? 'Editar publicación' : 'Nueva publicación'"
    :subtitulo="editando ? 'Actualiza los datos, las fotos y el estado.' : 'Completa los datos. Luego podrás agregar fotos.'"
  >

    <template #acciones>
      <router-link class="p-btn sec" to="/anfitrion/publicaciones">← Volver</router-link>

      <router-link
        v-if="editando && esReservable && esAnfitrion"
        class="p-btn sec"
        :to="`/anfitrion/publicaciones/${idServicio}/disponibilidad`"
      >
        Disponibilidad
      </router-link>
    </template>

    <div v-if="cargando" class="bloque-cargando"><span class="spinner"></span> Cargando…</div>

    <p v-else-if="errorCarga" class="aviso-error">{{ errorCarga }} <button @click="iniciar">Reintentar</button></p>

    <template v-else>

      <p v-if="creada" class="aviso-ok">
        ¡Publicación creada! Agrega al menos una foto y, si es un alojamiento o actividad, define sus cupos en «Disponibilidad».
      </p>

      <p v-if="editando && estadoActual === 'OCULTO'" class="aviso-error">
        Esta publicación fue ocultada por moderación. Mientras siga así no será visible y no podrás reactivarla.
      </p>

      <form class="p-card" @submit.prevent="guardar" novalidate>

        <div class="p-form-grid">

          <div class="p-campo">
            <label for="tipo">Tipo</label>
            <select id="tipo" class="p-select" v-model="form.tipo" :disabled="editando || tiposPermitidos.length === 1">
              <option v-for="t in tiposPermitidos" :key="t" :value="t">{{ TIPOS[t].etiqueta }}</option>
            </select>
            <small v-if="editando">El tipo no se puede cambiar.</small>
          </div>

          <div class="p-campo">
            <label for="categoria">Categoría</label>
            <select id="categoria" class="p-select" v-model="form.id_categoria">
              <option value="" disabled>Elige una categoría</option>
              <option v-for="c in categorias" :key="c.id_categoria" :value="c.id_categoria">{{ c.nombre }}</option>
            </select>
            <span v-if="errores.id_categoria" class="campo-error">{{ errores.id_categoria }}</span>
          </div>

          <div class="p-campo ancho">
            <label for="titulo">Título</label>
            <input id="titulo" class="p-input" type="text" v-model.trim="form.titulo" maxlength="120">
            <span v-if="errores.titulo" class="campo-error">{{ errores.titulo }}</span>
          </div>

          <div class="p-campo ancho">
            <label for="descripcion">Descripción</label>
            <textarea id="descripcion" class="p-textarea" rows="5" v-model.trim="form.descripcion" maxlength="5000"></textarea>
            <span v-if="errores.descripcion" class="campo-error">{{ errores.descripcion }}</span>
          </div>

          <template v-if="esReservable">

            <div class="p-campo">
              <label for="precio">Precio base (COP) {{ form.tipo === 'ALOJAMIENTO' ? 'por noche' : 'por persona y por día' }}</label>
              <input id="precio" class="p-input" type="number" min="0" step="1000" v-model="form.precio_base">
              <span v-if="errores.precio_base" class="campo-error">{{ errores.precio_base }}</span>
            </div>

            <div class="p-campo">
              <label for="capacidad">Capacidad máxima (personas)</label>
              <input id="capacidad" class="p-input" type="number" min="1" max="1000" v-model="form.capacidad_max">
              <span v-if="errores.capacidad_max" class="campo-error">{{ errores.capacidad_max }}</span>
            </div>

          </template>

          <div class="p-campo">
            <label for="localidad">Localidad</label>
            <input id="localidad" class="p-input" type="text" v-model.trim="form.localidad" maxlength="100" placeholder="Ej. Salento">
            <span v-if="errores.localidad" class="campo-error">{{ errores.localidad }}</span>
          </div>

          <div class="p-campo">
            <label for="direccion">Dirección <small>(opcional)</small></label>
            <input id="direccion" class="p-input" type="text" v-model.trim="form.direccion" maxlength="200">
          </div>

          <div class="p-campo">
            <label for="latitud">Latitud</label>
            <input id="latitud" class="p-input" type="number" step="any" v-model="form.latitud" placeholder="4.6370">
            <span v-if="errores.latitud" class="campo-error">{{ errores.latitud }}</span>
          </div>

          <div class="p-campo">
            <label for="longitud">Longitud</label>
            <input id="longitud" class="p-input" type="number" step="any" v-model="form.longitud" placeholder="-75.5700">
            <span v-if="errores.longitud" class="campo-error">{{ errores.longitud }}</span>
          </div>

          <div class="p-campo ancho">
            <button type="button" class="p-btn sec peq" style="align-self: flex-start" @click="usarUbicacion">
              ⌖ Usar mi ubicación actual
            </button>
            <small>La latitud y la longitud se usan para mostrar la publicación en el mapa y buscar por cercanía.</small>
          </div>

          <div class="p-campo ancho">
            <label for="contacto">
              Contacto {{ form.tipo === 'NEGOCIO_LOCAL' ? '' : '(opcional)' }}
            </label>
            <input id="contacto" class="p-input" type="text" v-model.trim="form.contacto" maxlength="150" placeholder="Teléfono, WhatsApp o correo">
            <span v-if="errores.contacto" class="campo-error">{{ errores.contacto }}</span>
          </div>

          <div v-if="editando && estadoActual !== 'OCULTO'" class="p-campo">
            <label for="estado">Estado</label>
            <select id="estado" class="p-select" v-model="form.estado">
              <option value="ACTIVO">Activa (visible)</option>
              <option value="INACTIVO">Inactiva (oculta al público)</option>
            </select>
          </div>

        </div>

        <p v-if="errorForm" class="aviso-error">{{ errorForm }}</p>
        <p v-if="exito" class="aviso-ok">{{ exito }}</p>

        <div class="p-acciones">
          <button type="submit" class="p-btn" :disabled="guardando">
            <span v-if="guardando" class="spinner blanco"></span>
            {{ editando ? 'Guardar cambios' : 'Crear publicación' }}
          </button>
        </div>

      </form>

      <FotosServicio
        v-if="editando"
        :id-servicio="idServicio"
        :fotos="fotos"
        @cambio="recargarFotos"
      />

    </template>

  </PanelLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PanelLayout from '../../components/PanelLayout.vue'
import FotosServicio from '../../components/FotosServicio.vue'
import { crearServicio, actualizarServicio, detalleServicio } from '../../services/anfitrion'
import { listarCategorias, TIPOS } from '../../services/destinos'
import { sesion } from '../../services/auth'
import { mensajeError, erroresPorCampo } from '../../services/api'

const route = useRoute()
const router = useRouter()

const idServicio = computed(() => (route.params.id ? Number(route.params.id) : null))
const editando = computed(() => idServicio.value !== null)
const creada = computed(() => route.query.creada === '1')

const esAnfitrion = computed(() => sesion.usuario?.rol === 'ANFITRION')

// Anfitrión: alojamientos y actividades. Negocio local: solo su negocio (RF-06).
const tiposPermitidos = computed(() => (esAnfitrion.value ? ['ALOJAMIENTO', 'ACTIVIDAD'] : ['NEGOCIO_LOCAL']))
const esReservable = computed(() => form.tipo !== 'NEGOCIO_LOCAL')

const categorias = ref([])
const fotos = ref([])
const estadoActual = ref('ACTIVO')

const cargando = ref(true)
const errorCarga = ref('')
const guardando = ref(false)
const errorForm = ref('')
const exito = ref('')
const errores = ref({})

const form = reactive({
  tipo: '',
  id_categoria: '',
  titulo: '',
  descripcion: '',
  precio_base: '',
  capacidad_max: '',
  localidad: '',
  direccion: '',
  latitud: '',
  longitud: '',
  contacto: '',
  estado: 'ACTIVO'
})

function aFormulario(s) {
  form.tipo = s.tipo
  form.id_categoria = s.id_categoria
  form.titulo = s.titulo
  form.descripcion = s.descripcion
  form.precio_base = s.precio_base ?? ''
  form.capacidad_max = s.capacidad_max ?? ''
  form.localidad = s.localidad
  form.direccion = s.direccion ?? ''
  form.latitud = s.latitud ?? ''
  form.longitud = s.longitud ?? ''
  form.contacto = s.contacto ?? ''
  form.estado = s.estado === 'OCULTO' ? 'ACTIVO' : s.estado
  estadoActual.value = s.estado
  fotos.value = s.fotos || []
}

async function iniciar() {
  cargando.value = true
  errorCarga.value = ''
  errores.value = {}

  try {
    categorias.value = await listarCategorias()

    if (editando.value) {
      aFormulario(await detalleServicio(idServicio.value))
    } else {
      Object.assign(form, {
        tipo: tiposPermitidos.value[0], id_categoria: '', titulo: '', descripcion: '', precio_base: '',
        capacidad_max: '', localidad: '', direccion: '', latitud: '', longitud: '', contacto: '', estado: 'ACTIVO'
      })
      fotos.value = []
      exito.value = ''
      errorForm.value = ''
    }
  } catch (e) {
    errorCarga.value = mensajeError(e, 'No pudimos cargar la publicación.')
  } finally {
    cargando.value = false
  }
}

onMounted(iniciar)

// Si se navega de "nueva" a "editar" (o viceversa) con el mismo componente
watch(() => route.params.id, () => {
  if (route.name === 'AnfitrionNueva' || route.name === 'AnfitrionEditar') iniciar()
})

async function recargarFotos() {
  try {
    fotos.value = (await detalleServicio(idServicio.value)).fotos || []
  } catch {
    // Se conserva la lista anterior
  }
}

function usarUbicacion() {
  if (!navigator.geolocation) {
    errorForm.value = 'Tu navegador no permite obtener la ubicación.'
    return
  }

  navigator.geolocation.getCurrentPosition(
    (p) => {
      form.latitud = Number(p.coords.latitude.toFixed(6))
      form.longitud = Number(p.coords.longitude.toFixed(6))
    },
    () => { errorForm.value = 'No pudimos obtener tu ubicación. Revisa los permisos del navegador.' },
    { timeout: 10000 }
  )
}

const vacio = (v) => v === '' || v === null || v === undefined

function validar() {
  const e = {}

  if (vacio(form.id_categoria)) e.id_categoria = 'Elige una categoría.'
  if (form.titulo.length < 3) e.titulo = 'El título debe tener al menos 3 caracteres.'
  if (form.descripcion.length < 10) e.descripcion = 'Describe tu publicación (mínimo 10 caracteres).'
  if (form.localidad.length < 2) e.localidad = 'Indica la localidad.'

  if (esReservable.value) {
    if (vacio(form.precio_base) || Number(form.precio_base) < 0) e.precio_base = 'Indica el precio base.'
    if (vacio(form.capacidad_max) || Number(form.capacidad_max) < 1) e.capacidad_max = 'Indica la capacidad máxima.'
  } else if (!form.contacto) {
    e.contacto = 'Los negocios locales deben indicar un dato de contacto.'
  }

  if (vacio(form.latitud) !== vacio(form.longitud)) {
    e.latitud = 'Escribe latitud y longitud juntas, o deja ambas vacías.'
  } else if (!vacio(form.latitud)) {
    if (Number(form.latitud) < -90 || Number(form.latitud) > 90) e.latitud = 'La latitud va de -90 a 90.'
    if (Number(form.longitud) < -180 || Number(form.longitud) > 180) e.longitud = 'La longitud va de -180 a 180.'
  }

  errores.value = e
  return Object.keys(e).length === 0
}

function cuerpo() {
  const num = (v) => (vacio(v) ? null : Number(v))

  const base = {
    id_categoria: Number(form.id_categoria),
    titulo: form.titulo,
    descripcion: form.descripcion,
    localidad: form.localidad,
    direccion: form.direccion || null,
    latitud: num(form.latitud),
    longitud: num(form.longitud),
    contacto: form.contacto || null
  }

  if (esReservable.value) {
    base.precio_base = num(form.precio_base)
    base.capacidad_max = num(form.capacidad_max)
  }

  return base
}

async function guardar() {
  if (guardando.value) return

  errorForm.value = ''
  exito.value = ''

  if (!validar()) return

  guardando.value = true

  try {
    if (editando.value) {
      const patch = { ...cuerpo() }
      if (estadoActual.value !== 'OCULTO') patch.estado = form.estado

      aFormulario(await actualizarServicio(idServicio.value, patch))
      exito.value = 'Los cambios se guardaron.'
    } else {
      const nueva = await crearServicio({ tipo: form.tipo, ...cuerpo() })
      router.replace({ path: `/anfitrion/publicaciones/${nueva.id_servicio}`, query: { creada: '1' } })
    }
  } catch (e) {
    errores.value = erroresPorCampo(e)
    if (!Object.keys(errores.value).length) errorForm.value = mensajeError(e, 'No pudimos guardar la publicación.')
  } finally {
    guardando.value = false
  }
}
</script>
