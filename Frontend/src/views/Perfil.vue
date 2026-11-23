<template>
  <main class="perfil-page">

    <!-- ENCABEZADO -->
    <header class="topbar">
      <div class="brand">
        <h1>raíz</h1>
        <span>ECOTURISMO Y CONEXIÓN</span>
      </div>

      <button class="volver" @click="router.push('/explorar')">
        ←
      </button>
    </header>

    <!-- INFORMACIÓN DEL USUARIO -->
    <section class="perfil-contenido">

      <div class="perfil-usuario">
        <div class="avatar">{{ inicial }}</div>

        <h2>{{ sesion.usuario?.nombre }}</h2>
        <p>{{ sesion.usuario?.correo }}</p>
        <p v-if="sesion.usuario?.telefono" class="telefono">{{ sesion.usuario.telefono }}</p>

        <button v-if="!editando" class="editar" @click="editarPerfil">
          Editar perfil
        </button>
      </div>

      <!-- FORMULARIO DE EDICIÓN (RF-05) -->
      <form v-if="editando" class="editar-form" @submit.prevent="guardar">

        <div class="campo">
          <label for="nombre">Nombre</label>
          <input id="nombre" type="text" v-model.trim="nombre" maxlength="100">
          <span v-if="errores.nombre" class="campo-error">{{ errores.nombre }}</span>
        </div>

        <div class="campo">
          <label for="telefono">Teléfono</label>
          <input id="telefono" type="tel" v-model.trim="telefono" placeholder="300 123 4567">
          <span v-if="errores.telefono" class="campo-error">{{ errores.telefono }}</span>
        </div>

        <p v-if="errorForm" class="aviso-error">{{ errorForm }}</p>

        <div class="editar-acciones">
          <button type="button" class="btn-secundario" :disabled="guardando" @click="editando = false">
            Cancelar
          </button>
          <button type="submit" class="btn-primario" :disabled="guardando">
            <span v-if="guardando" class="spinner blanco"></span>
            Guardar
          </button>
        </div>

      </form>

      <p v-if="exito" class="aviso-ok">{{ exito }}</p>

      <!-- MI ACTIVIDAD -->
      <section class="seccion">
        <h3>Mi actividad</h3>

        <button class="opcion" @click="router.push('/mis-reservas')">
          <span class="opcion-icono">▣</span>
          <span class="opcion-texto">
            <strong>Mis reservas</strong>
            <small>Consulta tus próximas experiencias</small>
          </span>
          <span class="flecha">›</span>
        </button>

        <button class="opcion" @click="irResenas">
          <span class="opcion-icono">★</span>
          <span class="opcion-texto">
            <strong>Mis reseñas</strong>
            <small>Opiniones sobre tus experiencias</small>
          </span>
          <span class="flecha">›</span>
        </button>

        <button class="opcion" @click="router.push('/notificaciones')">
          <span class="opcion-icono">♫</span>
          <span class="opcion-texto">
            <strong>Notificaciones</strong>
            <small>Pagos, reservas y avisos</small>
          </span>
          <span v-if="noLeidas > 0" class="contador-badge">{{ noLeidas }}</span>
          <span class="flecha">›</span>
        </button>
      </section>

      <!-- CONFIGURACIÓN -->
      <section class="seccion">
        <h3>Cuenta</h3>

        <button class="opcion" @click="configuracion">
          <span class="opcion-icono">⚙</span>
          <span class="opcion-texto">
            <strong>Configuración</strong>
            <small>Contraseña y eliminación de cuenta</small>
          </span>
          <span class="flecha">›</span>
        </button>

        <button class="opcion" @click="salir" :disabled="saliendo">
          <span class="opcion-icono">↪</span>
          <span class="opcion-texto">
            <strong>Cerrar sesión</strong>
            <small>Salir de tu cuenta</small>
          </span>
          <span class="flecha">›</span>
        </button>
      </section>

    </section>

    <!-- NAVEGACIÓN INFERIOR -->
    <nav class="bottom-nav">

      <button class="nav-item" @click="router.push('/explorar')">
        <span>⌂</span>
        <small>Explorar</small>
      </button>

      <button class="nav-item" @click="irMapa">
        <span>⌖</span>
        <small>Mapa</small>
      </button>

      <button class="nav-item" @click="router.push('/mis-reservas')">
        <span>▣</span>
        <small>Mis reservas</small>
      </button>

      <button class="nav-item activo">
        <span>♙</span>
        <small>Perfil</small>
      </button>

    </nav>

  </main>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { sesion, inicialUsuario, cargarUsuario, actualizarPerfil, cerrarSesion } from '../services/auth'
import { contarNoLeidas } from '../services/notificaciones'
import { mensajeError, erroresPorCampo } from '../services/api'

const router = useRouter()

const inicial = computed(() => inicialUsuario())
const noLeidas = ref(0)

// Se muestran los datos guardados y se refrescan con los del servidor
onMounted(async () => {
  try { await cargarUsuario() } catch { /* se mantienen los datos locales */ }
  try { noLeidas.value = await contarNoLeidas() } catch { /* contador opcional */ }
})


// EDITAR PERFIL

const editando = ref(false)
const nombre = ref('')
const telefono = ref('')
const guardando = ref(false)
const errores = ref({})
const errorForm = ref('')
const exito = ref('')

function editarPerfil() {
  nombre.value = sesion.usuario?.nombre || ''
  telefono.value = sesion.usuario?.telefono || ''
  errores.value = {}
  errorForm.value = ''
  exito.value = ''
  editando.value = true
}

async function guardar() {
  if (guardando.value) return

  errores.value = {}
  errorForm.value = ''

  if (nombre.value.length < 2) {
    errores.value = { nombre: 'Escribe tu nombre.' }
    return
  }

  guardando.value = true

  try {
    await actualizarPerfil({ nombre: nombre.value, telefono: telefono.value })
    editando.value = false
    exito.value = 'Tus datos se actualizaron.'
  } catch (e) {
    errores.value = erroresPorCampo(e)
    if (!Object.keys(errores.value).length) errorForm.value = mensajeError(e, 'No pudimos guardar los cambios.')
  } finally {
    guardando.value = false
  }
}


// NAVEGACIÓN Y SESIÓN

function irResenas() {
  router.push('/resenas')
}

function configuracion() {
  router.push('/configuracion')
}

const saliendo = ref(false)

async function salir() {
  saliendo.value = true
  await cerrarSesion()
  router.replace('/')
}

function irMapa() {
  router.push('/mapa')
}

</script>

<style scoped>
.perfil-page {
  width: 100%;
  max-width: 430px;
  min-height: 100vh;
  margin: 0 auto;
  padding-bottom: 90px;
  background: #f7f6f0;
  color: #263b30;
}

/* ENCABEZADO */
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 22px 23px 15px;
}

.brand h1 {
  font-family: Georgia, serif;
  font-size: 34px;
  font-weight: normal;
  line-height: 1;
}

.brand span {
  font-size: 8px;
  letter-spacing: 1.5px;
  color: #77776f;
}

.volver {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: #ebe9df;
  color: #365541;
  font-size: 20px;
}

/* CONTENIDO */
.perfil-contenido {
  padding: 20px 22px;
}

/* USUARIO */
.perfil-usuario {
  text-align: center;
  padding: 20px 0 30px;
}

.avatar {
  width: 82px;
  height: 82px;
  margin: 0 auto 14px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  background: #e5e9df;
  color: #28523d;
  font-family: Georgia, serif;
  font-size: 32px;
}

.perfil-usuario h2 {
  font-family: Georgia, serif;
  font-size: 25px;
  font-weight: normal;
  margin-bottom: 6px;
}

.perfil-usuario p {
  color: #89897f;
  font-size: 12px;
}

.editar {
  margin-top: 16px;
  padding: 9px 20px;
  border: 1px solid #28523d;
  border-radius: 20px;
  background: transparent;
  color: #28523d;
  font-size: 11px;
}

/* SECCIONES */
.seccion {
  margin-top: 20px;
}

.seccion h3 {
  font-family: Georgia, serif;
  font-size: 20px;
  font-weight: normal;
  margin-bottom: 12px;
}

.opcion {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px 12px;
  margin-bottom: 9px;
  background: white;
  border: 1px solid #eeede7;
  border-radius: 11px;
  text-align: left;
  color: #263b30;
}

.opcion-icono {
  width: 35px;
  height: 35px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  background: #edf1e9;
  color: #28523d;
  font-size: 17px;
}

.opcion-texto {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.opcion-texto strong {
  font-size: 12px;
  font-weight: 600;
}

.opcion-texto small {
  color: #89897f;
  font-size: 10px;
}

.flecha {
  color: #718174;
  font-size: 22px;
}

/* NAVEGACIÓN */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 430px;
  height: 70px;
  background: #fff;
  border-top: 1px solid #e9e7df;
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 10;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: #999b91;
}

.nav-item span {
  font-size: 21px;
}

.nav-item small {
  font-size: 9px;
}

.nav-item.activo {
  color: #28523d;
}

.nav-item.activo small {
  font-weight: bold;
}

/* ===== CONEXIÓN CON LA API ===== */
.telefono {
  margin-top: 2px;
}

.editar-form {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 18px;
  box-shadow: 0 3px 12px rgba(35, 55, 40, 0.06);
}

.campo {
  display: flex;
  flex-direction: column;
  margin-bottom: 14px;
}

.campo label {
  font-size: 12px;
  margin-bottom: 6px;
  color: #263b30;
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

.editar-acciones {
  display: flex;
  gap: 10px;
}

.contador-badge {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: #c0463f;
  color: white;
  font-size: 10px;
  line-height: 20px;
  text-align: center;
  margin-right: 6px;
}

.perfil-contenido .aviso-ok {
  margin: 0 0 16px;
}

</style>
