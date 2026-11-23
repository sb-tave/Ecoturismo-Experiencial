<template>
  <main class="config-page">

    <header class="config-header">

      <button class="volver" @click="router.push('/perfil')" aria-label="Volver">
        ←
      </button>

      <div>
        <small>RAÍZ · CUENTA</small>
        <h1>Configuración</h1>
      </div>

    </header>


    <!-- CAMBIAR CONTRASEÑA (RF-05) -->
    <form class="bloque" @submit.prevent="cambiar" novalidate>

      <h2>Cambiar contraseña</h2>

      <div class="campo">
        <label for="actual">Contraseña actual</label>
        <input id="actual" type="password" v-model="actual" autocomplete="current-password">
        <span v-if="errores.contrasena_actual" class="campo-error">{{ errores.contrasena_actual }}</span>
      </div>

      <div class="campo">
        <label for="nueva">Contraseña nueva</label>
        <input id="nueva" type="password" v-model="nueva" autocomplete="new-password">
        <span v-if="errores.contrasena_nueva" class="campo-error">{{ errores.contrasena_nueva }}</span>
        <span v-else class="ayuda">Mínimo 8 caracteres, con al menos una letra y un número.</span>
      </div>

      <div class="campo">
        <label for="confirmar">Confirmar contraseña nueva</label>
        <input id="confirmar" type="password" v-model="confirmar" autocomplete="new-password">
        <span v-if="errores.confirmar" class="campo-error">{{ errores.confirmar }}</span>
      </div>

      <p v-if="errorPass" class="aviso-error">{{ errorPass }}</p>
      <p v-if="exitoPass" class="aviso-ok">{{ exitoPass }}</p>

      <button type="submit" class="btn-primario" :disabled="cambiando">
        <span v-if="cambiando" class="spinner blanco"></span>
        Actualizar contraseña
      </button>

    </form>


    <!-- ELIMINAR CUENTA (RNF-07) -->
    <section class="bloque peligro">

      <h2>Eliminar mi cuenta</h2>

      <p>
        Tus datos personales se anonimizan y ya no podrás ingresar.
        No puedes eliminarla si tienes reservas activas.
      </p>

      <button class="btn-peligro" @click="abrirEliminar">
        Eliminar cuenta
      </button>

    </section>

    <button class="btn-secundario salir" :disabled="saliendo" @click="salir">
      Cerrar sesión
    </button>


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
      <div class="campo">
        <input
          type="password"
          v-model="contrasenaEliminar"
          placeholder="Tu contraseña"
          autocomplete="current-password"
        >
      </div>

      <p v-if="errorEliminar" class="aviso-error">{{ errorEliminar }}</p>
    </ConfirmarModal>

  </main>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import ConfirmarModal from '../components/ConfirmarModal.vue'
import { cambiarContrasena, eliminarCuenta, cerrarSesion } from '../services/auth'
import { mensajeError, erroresPorCampo } from '../services/api'

const router = useRouter()


// CAMBIAR CONTRASEÑA

const actual = ref('')
const nueva = ref('')
const confirmar = ref('')
const errores = ref({})
const errorPass = ref('')
const exitoPass = ref('')
const cambiando = ref(false)

async function cambiar() {
  if (cambiando.value) return

  errorPass.value = ''
  exitoPass.value = ''
  errores.value = {}

  if (!actual.value) errores.value.contrasena_actual = 'Escribe tu contraseña actual.'
  if (nueva.value.length < 8 || !/[A-Za-z]/.test(nueva.value) || !/\d/.test(nueva.value)) {
    errores.value.contrasena_nueva = 'Mínimo 8 caracteres, con una letra y un número.'
  }
  if (confirmar.value !== nueva.value) errores.value.confirmar = 'Las contraseñas no coinciden.'
  if (Object.keys(errores.value).length) return

  cambiando.value = true

  try {
    await cambiarContrasena(actual.value, nueva.value)
    actual.value = nueva.value = confirmar.value = ''
    exitoPass.value = 'Tu contraseña fue actualizada.'
  } catch (e) {
    errores.value = erroresPorCampo(e)
    if (!Object.keys(errores.value).length) errorPass.value = mensajeError(e, 'No pudimos cambiar la contraseña.')
  } finally {
    cambiando.value = false
  }
}


// ELIMINAR CUENTA

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
    // Por ejemplo: contraseña incorrecta o reservas activas
    errorEliminar.value = mensajeError(e, 'No pudimos eliminar tu cuenta.')
  } finally {
    eliminando.value = false
  }
}


// CERRAR SESIÓN

const saliendo = ref(false)

async function salir() {
  saliendo.value = true
  await cerrarSesion()
  router.replace('/')
}
</script>

<style scoped>

.config-page {
  width: 100%;
  max-width: 430px;
  min-height: 100vh;
  margin: 0 auto;
  padding: 20px 20px 40px;
  background: #f7f6f0;
  color: #263b30;
}

.config-header {
  display: flex;
  align-items: center;
  gap: 13px;
  margin-bottom: 22px;
}

.volver {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border: none;
  border-radius: 50%;
  background: #e9ede4;
  color: #31543d;
  font-size: 19px;
}

.config-header small {
  font-size: 8px;
  letter-spacing: 1px;
  color: #8a8c80;
}

.config-header h1 {
  font-family: Georgia, serif;
  font-weight: normal;
  font-size: 25px;
  margin-top: 4px;
}

.bloque {
  background: white;
  border-radius: 12px;
  padding: 18px 16px;
  margin-bottom: 16px;
  box-shadow: 0 3px 12px rgba(35, 55, 40, 0.06);
}

.bloque h2 {
  font-family: Georgia, serif;
  font-weight: normal;
  font-size: 18px;
  margin-bottom: 14px;
}

.bloque.peligro p {
  font-size: 12px;
  line-height: 1.5;
  color: #6f7168;
  margin-bottom: 14px;
}

.campo {
  display: flex;
  flex-direction: column;
  margin-bottom: 14px;
}

.campo label {
  font-size: 12px;
  margin-bottom: 6px;
}

.campo input {
  height: 42px;
  border: 1px solid #deded5;
  border-radius: 8px;
  padding: 0 12px;
  background: #fdfdfb;
  font-size: 12px;
  color: #263b30;
  outline: none;
}

.campo input:focus {
  border-color: #315b43;
}

.ayuda {
  margin-top: 5px;
  font-size: 10.5px;
  color: #8a8c80;
}

.salir {
  margin-top: 4px;
}

</style>
