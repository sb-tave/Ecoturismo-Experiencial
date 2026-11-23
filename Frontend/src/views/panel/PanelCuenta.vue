<template>
  <PanelLayout titulo="Mi cuenta" subtitulo="Tus datos y tu seguridad.">

    <div class="dos-columnas">

      <!-- DATOS PERSONALES -->
      <form class="p-card" @submit.prevent="guardarPerfil" novalidate>

        <h2>Datos personales</h2>

        <div class="p-form-grid">

          <div class="p-campo ancho">
            <label for="correo">Correo</label>
            <input id="correo" class="p-input" type="email" :value="sesion.usuario?.correo" disabled>
            <small>El correo no se puede cambiar.</small>
          </div>

          <div class="p-campo ancho">
            <label for="nombre">Nombre</label>
            <input id="nombre" class="p-input" type="text" v-model.trim="nombre" maxlength="100">
            <span v-if="errPerfil.nombre" class="campo-error">{{ errPerfil.nombre }}</span>
          </div>

          <div class="p-campo ancho">
            <label for="telefono">Teléfono</label>
            <input id="telefono" class="p-input" type="tel" v-model.trim="telefono">
            <span v-if="errPerfil.telefono" class="campo-error">{{ errPerfil.telefono }}</span>
          </div>

        </div>

        <p v-if="errorPerfil" class="aviso-error">{{ errorPerfil }}</p>
        <p v-if="exitoPerfil" class="aviso-ok">{{ exitoPerfil }}</p>

        <div class="p-acciones">
          <button type="submit" class="p-btn" :disabled="guardando">
            <span v-if="guardando" class="spinner blanco"></span> Guardar
          </button>
        </div>

      </form>

      <!-- CONTRASEÑA -->
      <form class="p-card" @submit.prevent="cambiarPass" novalidate>

        <h2>Cambiar contraseña</h2>

        <div class="p-form-grid">

          <div class="p-campo ancho">
            <label for="actual">Contraseña actual</label>
            <input id="actual" class="p-input" type="password" v-model="actual" autocomplete="current-password">
            <span v-if="errPass.contrasena_actual" class="campo-error">{{ errPass.contrasena_actual }}</span>
          </div>

          <div class="p-campo ancho">
            <label for="nueva">Contraseña nueva</label>
            <input id="nueva" class="p-input" type="password" v-model="nueva" autocomplete="new-password">
            <span v-if="errPass.contrasena_nueva" class="campo-error">{{ errPass.contrasena_nueva }}</span>
            <small v-else>Mínimo 8 caracteres, con al menos una letra y un número.</small>
          </div>

          <div class="p-campo ancho">
            <label for="confirmar">Confirmar contraseña nueva</label>
            <input id="confirmar" class="p-input" type="password" v-model="confirmar" autocomplete="new-password">
            <span v-if="errPass.confirmar" class="campo-error">{{ errPass.confirmar }}</span>
          </div>

        </div>

        <p v-if="errorPass" class="aviso-error">{{ errorPass }}</p>
        <p v-if="exitoPass" class="aviso-ok">{{ exitoPass }}</p>

        <div class="p-acciones">
          <button type="submit" class="p-btn" :disabled="cambiando">
            <span v-if="cambiando" class="spinner blanco"></span> Actualizar contraseña
          </button>
        </div>

      </form>

    </div>

    <!-- ELIMINAR CUENTA (los administradores no pueden eliminar la suya desde aquí) -->
    <section v-if="sesion.usuario?.rol !== 'ADMINISTRADOR'" class="p-card">

      <h2>Eliminar mi cuenta</h2>
      <p class="ayuda">
        Tus datos personales se anonimizan y ya no podrás ingresar. No se puede si tienes reservas activas.
        Tus publicaciones se conservan para los reportes.
      </p>

      <button class="p-btn mal" @click="abrirEliminar">Eliminar cuenta</button>

    </section>

    <ConfirmarModal
      :abierto="modalEliminar"
      titulo="¿Eliminar tu cuenta?"
      mensaje="Esta acción es permanente. Escribe tu contraseña para confirmar."
      texto-confirmar="Eliminar definitivamente"
      peligro
      :cargando="eliminando"
      :deshabilitado="!contrasenaEliminar"
      @confirmar="eliminar"
      @cancelar="modalEliminar = false"
    >
      <input class="p-input" style="width: 100%; margin-bottom: 10px" type="password" v-model="contrasenaEliminar" placeholder="Tu contraseña" autocomplete="current-password">
      <p v-if="errorEliminar" class="aviso-error">{{ errorEliminar }}</p>
    </ConfirmarModal>

  </PanelLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import PanelLayout from '../../components/PanelLayout.vue'
import ConfirmarModal from '../../components/ConfirmarModal.vue'
import { sesion, cargarUsuario, actualizarPerfil, cambiarContrasena, eliminarCuenta } from '../../services/auth'
import { mensajeError, erroresPorCampo } from '../../services/api'

const router = useRouter()

// ---- Datos personales (RF-05) ----

const nombre = ref(sesion.usuario?.nombre || '')
const telefono = ref(sesion.usuario?.telefono || '')
const guardando = ref(false)
const errPerfil = ref({})
const errorPerfil = ref('')
const exitoPerfil = ref('')

onMounted(async () => {
  try {
    const u = await cargarUsuario()
    nombre.value = u.nombre
    telefono.value = u.telefono || ''
  } catch {
    // Se muestran los datos guardados
  }
})

async function guardarPerfil() {
  if (guardando.value) return

  errPerfil.value = {}
  errorPerfil.value = ''
  exitoPerfil.value = ''

  if (nombre.value.length < 2) { errPerfil.value = { nombre: 'Escribe tu nombre.' }; return }

  guardando.value = true

  try {
    await actualizarPerfil({ nombre: nombre.value, telefono: telefono.value })
    exitoPerfil.value = 'Tus datos se actualizaron.'
  } catch (e) {
    errPerfil.value = erroresPorCampo(e)
    if (!Object.keys(errPerfil.value).length) errorPerfil.value = mensajeError(e, 'No pudimos guardar los cambios.')
  } finally {
    guardando.value = false
  }
}

// ---- Contraseña ----

const actual = ref('')
const nueva = ref('')
const confirmar = ref('')
const cambiando = ref(false)
const errPass = ref({})
const errorPass = ref('')
const exitoPass = ref('')

async function cambiarPass() {
  if (cambiando.value) return

  errPass.value = {}
  errorPass.value = ''
  exitoPass.value = ''

  const e = {}
  if (!actual.value) e.contrasena_actual = 'Escribe tu contraseña actual.'
  if (nueva.value.length < 8 || !/[A-Za-z]/.test(nueva.value) || !/\d/.test(nueva.value)) e.contrasena_nueva = 'Mínimo 8 caracteres, con una letra y un número.'
  if (confirmar.value !== nueva.value) e.confirmar = 'Las contraseñas no coinciden.'
  if (Object.keys(e).length) { errPass.value = e; return }

  cambiando.value = true

  try {
    await cambiarContrasena(actual.value, nueva.value)
    actual.value = nueva.value = confirmar.value = ''
    exitoPass.value = 'Tu contraseña fue actualizada.'
  } catch (err) {
    errPass.value = erroresPorCampo(err)
    if (!Object.keys(errPass.value).length) errorPass.value = mensajeError(err, 'No pudimos cambiar la contraseña.')
  } finally {
    cambiando.value = false
  }
}

// ---- Eliminar cuenta (RNF-07) ----

const modalEliminar = ref(false)
const contrasenaEliminar = ref('')
const errorEliminar = ref('')
const eliminando = ref(false)

function abrirEliminar() {
  contrasenaEliminar.value = ''
  errorEliminar.value = ''
  modalEliminar.value = true
}

async function eliminar() {
  eliminando.value = true
  errorEliminar.value = ''

  try {
    await eliminarCuenta(contrasenaEliminar.value)
    router.replace('/')
  } catch (e) {
    errorEliminar.value = mensajeError(e, 'No pudimos eliminar tu cuenta.')
  } finally {
    eliminando.value = false
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
