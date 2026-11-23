<template>
  <main class="login-page">

    <section class="hero hero-corto">
      <div class="hero-content">
        <div class="logo">
          <h1>raíz</h1>
          <span>ECOTURISMO Y CONEXIÓN</span>
        </div>
      </div>
    </section>

    <section class="login-card">

      <div class="welcome">
        <h2>Crea tu cuenta</h2>
        <p>Reserva experiencias de naturaleza en pocos pasos.</p>
      </div>

      <form @submit.prevent="registrar" novalidate>

        <div class="form-group">
          <label>Tipo de cuenta</label>
          <div class="tipos-cuenta">
            <button
              v-for="t in tiposCuenta"
              :key="t.valor"
              type="button"
              :class="{ activo: rol === t.valor }"
              @click="rol = t.valor"
            >
              <strong>{{ t.titulo }}</strong>
              <small>{{ t.detalle }}</small>
            </button>
          </div>
        </div>

        <div class="form-group">
          <label for="nombre">Nombre completo</label>
          <input id="nombre" type="text" v-model.trim="nombre" placeholder="Tu nombre" autocomplete="name" maxlength="100">
          <span v-if="errores.nombre" class="campo-error">{{ errores.nombre }}</span>
        </div>

        <div class="form-group">
          <label for="correo">Correo electrónico</label>
          <input id="correo" type="email" v-model.trim="correo" placeholder="tu@correo.com" autocomplete="email">
          <span v-if="errores.correo" class="campo-error">{{ errores.correo }}</span>
        </div>

        <div class="form-group">
          <label for="telefono">Teléfono <small>(opcional)</small></label>
          <input id="telefono" type="tel" v-model.trim="telefono" placeholder="300 123 4567" autocomplete="tel">
          <span v-if="errores.telefono" class="campo-error">{{ errores.telefono }}</span>
        </div>

        <div class="form-group">
          <label for="contrasena">Contraseña</label>
          <input id="contrasena" type="password" v-model="contrasena" placeholder="Mínimo 8 caracteres" autocomplete="new-password">
          <span v-if="errores.contrasena" class="campo-error">{{ errores.contrasena }}</span>
          <span v-else class="ayuda-campo">Mínimo 8 caracteres, con al menos una letra y un número.</span>
        </div>

        <div class="form-group">
          <label for="confirmar">Confirmar contraseña</label>
          <input id="confirmar" type="password" v-model="confirmar" placeholder="Repite tu contraseña" autocomplete="new-password">
          <span v-if="errores.confirmar" class="campo-error">{{ errores.confirmar }}</span>
        </div>

        <label class="politica">
          <input type="checkbox" v-model="aceptaPolitica">
          <span>
            Acepto la política de tratamiento de datos personales
            <small v-if="politicaVersion">(versión {{ politicaVersion }})</small>
          </span>
        </label>
        <span v-if="errores.politica" class="campo-error politica-error">{{ errores.politica }}</span>

        <p v-if="error" class="aviso-error">{{ error }}</p>

        <button type="submit" class="login-button" :disabled="cargando">
          <span v-if="cargando" class="spinner blanco"></span>
          {{ cargando ? 'Creando cuenta…' : 'Crear cuenta' }}
        </button>

      </form>

      <p class="register">
        ¿Ya tienes una cuenta?
        <router-link to="/">Inicia sesión</router-link>
      </p>

    </section>

  </main>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { registrarse, obtenerPolitica, rutaInicio } from '../services/auth'
import { mensajeError, erroresPorCampo, codigoError } from '../services/api'

const router = useRouter()

const tiposCuenta = [
  { valor: 'TURISTA', titulo: 'Turista', detalle: 'Reservo experiencias' },
  { valor: 'ANFITRION', titulo: 'Anfitrión', detalle: 'Publico alojamientos y actividades' },
  { valor: 'NEGOCIO_LOCAL', titulo: 'Negocio local', detalle: 'Muestro mi negocio' }
]

const rol = ref('TURISTA')
const nombre = ref('')
const correo = ref('')
const telefono = ref('')
const contrasena = ref('')
const confirmar = ref('')
const aceptaPolitica = ref(false)

const politicaVersion = ref('')
const errores = ref({})
const error = ref('')
const cargando = ref(false)

// RF-02: se envía la versión vigente de la política que la persona acepta
onMounted(async () => {
  try {
    politicaVersion.value = await obtenerPolitica()
  } catch {
    // Si falla, el backend usa la versión vigente
  }
})

function validar() {
  const e = {}
  if (nombre.value.length < 2) e.nombre = 'Escribe tu nombre.'
  if (!/^\S+@\S+\.\S+$/.test(correo.value)) e.correo = 'Escribe un correo válido.'
  if (contrasena.value.length < 8) e.contrasena = 'Debe tener al menos 8 caracteres.'
  else if (!/[A-Za-z]/.test(contrasena.value) || !/\d/.test(contrasena.value)) {
    e.contrasena = 'Debe incluir al menos una letra y un número.'
  }
  if (confirmar.value !== contrasena.value) e.confirmar = 'Las contraseñas no coinciden.'
  if (!aceptaPolitica.value) e.politica = 'Debes aceptar la política para crear tu cuenta.'
  errores.value = e
  return Object.keys(e).length === 0
}

async function registrar() {
  if (cargando.value) return

  error.value = ''
  if (!validar()) return

  cargando.value = true

  try {
    const usuario = await registrarse({
      rol: rol.value,
      nombre: nombre.value,
      correo: correo.value,
      telefono: telefono.value,
      contrasena: contrasena.value,
      politicaVersion: politicaVersion.value || undefined
    })
    router.replace(rutaInicio(usuario.rol))
  } catch (e) {
    const porCampo = erroresPorCampo(e)
    errores.value = {
      nombre: porCampo.nombre,
      correo: porCampo.correo || (codigoError(e) === 'CORREO_DUPLICADO' ? 'Ya existe una cuenta con ese correo.' : undefined),
      telefono: porCampo.telefono,
      contrasena: porCampo.contrasena
    }
    // Si el error no es de un campo concreto, se muestra arriba del botón
    if (!Object.values(errores.value).some(Boolean)) error.value = mensajeError(e, 'No fue posible crear la cuenta.')
  } finally {
    cargando.value = false
  }
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
.tipos-cuenta {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tipos-cuenta button {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
  padding: 10px 12px;
  border: 1.5px solid #deded5;
  border-radius: 8px;
  background: white;
  color: #263b30;
}

.tipos-cuenta button strong {
  font-size: 12px;
  font-weight: normal;
}

.tipos-cuenta button small {
  font-size: 10.5px;
  color: #8a8c80;
}

.tipos-cuenta button.activo {
  border-color: #28523d;
  background: #f1f6ee;
}

.hero-corto {
  height: 170px;
}

.form-group label small {
  color: #9a9a90;
}

.ayuda-campo {
  margin-top: 5px;
  font-size: 10.5px;
  color: #8a8c80;
}

.politica {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  font-size: 11px;
  color: #55604f;
  line-height: 1.4;
  margin: 4px 0 6px;
}

.politica input {
  margin-top: 2px;
  accent-color: #28523d;
}

.politica-error {
  margin: 0 0 6px;
}

.login-button {
  margin-top: 10px;
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

</style>
