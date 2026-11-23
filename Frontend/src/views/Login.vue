<template>
  <main class="login-page">

    <!-- Portada con imagen -->
    <section class="hero">

      <div class="hero-content">

        <div class="logo">
          <h1>raíz</h1>
          <span>ECOTURISMO Y CONEXIÓN</span>
        </div>

        <div class="slogan">
          <h2>Más cerca de la naturaleza.</h2>
          <h2>Más cerca de ti.</h2>
        </div>

      </div>

    </section>

    <!-- Formulario de acceso -->
    <section class="login-card">

      <div class="welcome">
        <h2>Qué bueno verte aquí</h2>

        <p>
          Entra y encuentra tu próxima pausa natural.
        </p>
      </div>

      <p v-if="sesionExpirada && !error" class="aviso-info">
        Tu sesión venció. Inicia sesión de nuevo para continuar.
      </p>

      <form @submit.prevent="iniciarSesion">

        <div class="form-group">
          <label for="correo">Correo electrónico</label>

          <input
            id="correo"
            type="email"
            v-model.trim="correo"
            placeholder="tu@correo.com"
            autocomplete="email"
            required
          >
        </div>

        <div class="form-group">
          <label for="contrasena">Contraseña</label>

          <input
            id="contrasena"
            type="password"
            v-model="contrasena"
            placeholder="Ingresa tu contraseña"
            autocomplete="current-password"
            required
          >
        </div>

        <a href="#" class="forgot" @click.prevent="recuperar">
          ¿Olvidaste tu contraseña?
        </a>

        <p v-if="error" class="aviso-error">{{ error }}</p>

        <button type="submit" class="login-button" :disabled="cargando">
          <span v-if="cargando" class="spinner blanco"></span>
          {{ cargando ? 'Ingresando…' : 'Iniciar sesión' }}
        </button>

      </form>

      <div class="separator">
        <span>O</span>
      </div>

      <button
        type="button"
        class="google-button"
        @click="continuarGoogle"
      >
        Continuar con Google
      </button>

      <p class="register">
        ¿No tienes una cuenta?
        <router-link to="/registro">
          Regístrate
        </router-link>
      </p>

    </section>

  </main>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { iniciarSesion as login, rutaInicio } from '../services/auth'
import { mensajeError } from '../services/api'

const router = useRouter()
const route = useRoute()

const correo = ref('')
const contrasena = ref('')
const cargando = ref(false)
const error = ref('')
const sesionExpirada = route.query.expirada === '1'

async function iniciarSesion() {
  if (cargando.value) return

  error.value = ''
  cargando.value = true

  try {
    const usuario = await login(correo.value, contrasena.value)
    const inicio = rutaInicio(usuario.rol)

    // Vuelve a la pantalla que se intentaba abrir (solo rutas internas y de la misma sección que el rol)
    const destino = String(route.query.redirect || '')
    const seccion = inicio === '/explorar' ? '' : inicio
    const valido = destino.startsWith('/') && !destino.startsWith('//') && (seccion ? destino.startsWith(seccion) : !/^\/(admin|anfitrion)/.test(destino))
    router.replace(valido ? destino : inicio)
  } catch (e) {
    error.value = mensajeError(e, 'No fue posible iniciar sesión.')
  } finally {
    cargando.value = false
  }
}

// El backend aún no ofrece estas funciones
function recuperar() {
  alert('La recuperación de contraseña estará disponible próximamente.')
}

function continuarGoogle() {
  alert('La autenticación con Google estará disponible próximamente.')
}
</script>

<style scoped>

/* CONTENEDOR PRINCIPAL */

.login-page {
  min-height: 100vh;
  background: #f7f6f0;
  display: flex;
  flex-direction: column;
  color: #263b30;
}

/* PORTADA */

.hero {
  height: 310px;
  width: 100%;

  background-image:
    linear-gradient(
      rgba(20, 40, 30, 0.20),
      rgba(20, 40, 30, 0.45)
    ),
    url('../assets/hero.png');

  background-size: cover;
  background-position: center;

  color: white;
  padding: 30px 25px;

  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.hero-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.logo h1 {
  font-family: Georgia, serif;
  font-size: 43px;
  font-weight: normal;
  line-height: 1;
}

.logo span {
  font-size: 9px;
  letter-spacing: 2px;
}

.slogan h2 {
  font-family: Georgia, serif;
  font-size: 21px;
  font-weight: normal;
  margin-bottom: 5px;
}

/* FORMULARIO */

.login-card {
  width: 100%;
  background: #f7f6f0;

  padding: 25px 24px 35px;

  border-radius: 20px 20px 0 0;
  margin-top: -18px;

  position: relative;
}

.welcome h2 {
  font-family: Georgia, serif;
  font-size: 24px;
  font-weight: normal;
  margin-bottom: 8px;
}

.welcome p {
  font-size: 12px;
  color: #77776f;
  margin-bottom: 24px;
}

/* CAMPOS */

.form-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
}

.form-group label {
  font-size: 12px;
  margin-bottom: 7px;
}

.form-group input {
  height: 43px;
  border: 1px solid #deded5;
  border-radius: 8px;
  padding: 0 12px;
  background: white;
  outline: none;
  font-size: 12px;
  color: #263b30;
}

.form-group input:focus {
  border-color: #315b43;
}

.form-group input::placeholder {
  color: #aaa9a1;
}

/* RECUPERAR CONTRASEÑA */

.forgot {
  display: block;
  text-align: right;
  font-size: 11px;
  color: #315b43;
  text-decoration: none;
  margin-top: -5px;
  margin-bottom: 20px;
}

/* BOTONES */

.login-button {
  width: 100%;
  height: 44px;
  background: #28523d;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 12px;
}

.login-button:hover {
  background: #1d402e;
}

/* SEPARADOR */

.separator {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 19px 0;
  color: #999;
  font-size: 11px;
}

.separator::before,
.separator::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #deded5;
}

/* GOOGLE */

.google-button {
  width: 100%;
  height: 43px;
  background: white;
  border: 1px solid #deded5;
  border-radius: 8px;
  color: #444;
  font-size: 12px;
}

/* REGISTRO */

.register {
  text-align: center;
  font-size: 11px;
  color: #777;
  margin-top: 23px;
}

.register a {
  color: #28523d;
  font-weight: bold;
  text-decoration: none;
}

/* PANTALLAS GRANDES */

@media (min-width: 600px) {

  .login-page {
    justify-content: center;
    align-items: center;
    padding: 30px;
  }

  .hero {
    max-width: 420px;
    width: 100%;
    border-radius: 15px 15px 0 0;
  }

  .login-card {
    max-width: 420px;
    border-radius: 0 0 15px 15px;
  }

}

/* ===== CONEXIÓN CON LA API ===== */
.login-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.login-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.register a {
  color: #28523d;
  font-weight: bold;
  text-decoration: none;
}

.login-card .aviso-error,
.login-card .aviso-info {
  margin: 0 0 14px;
}

</style>
