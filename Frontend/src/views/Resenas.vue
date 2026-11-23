<template>
  <main class="resenas-page">

    <!-- ENCABEZADO -->
    <header class="topbar">
      <div class="brand">
        <h1>raíz</h1>
        <span>ECOTURISMO Y CONEXIÓN</span>
      </div>

      <button class="volver" @click="router.push('/perfil')">
        ←
      </button>
    </header>

    <!-- CONTENIDO -->
    <section class="contenido">

      <div class="titulo">
        <h2>Mis reseñas</h2>
        <p>
          Comparte tus experiencias y ayuda a otros viajeros
          a descubrir nuevos lugares.
        </p>
      </div>

      <!-- RESUMEN -->
      <div class="resumen">
        <div class="resumen-icono">★</div>

        <div>
          <h3>Tus experiencias</h3>
          <p>Opiniones sobre los destinos que has visitado</p>
        </div>
      </div>

      <p v-if="exito" class="aviso-ok">{{ exito }}</p>
      <p v-if="error" class="aviso-error">{{ error }}</p>

      <!-- CARGANDO -->
      <div v-if="cargando" class="bloque-cargando">
        <span class="spinner"></span> Cargando…
      </div>

      <template v-else>

        <!-- FORMULARIO PARA ESCRIBIR RESEÑA -->
        <section v-if="reservaActual" class="formulario-resena">

          <h3>Califica tu experiencia</h3>

          <p class="destino-resena">
            {{ reservaActual.destino }}
          </p>

          <p class="instruccion">¿Cómo calificarías tu visita?</p>

          <div class="estrellas">
            <button
              v-for="estrella in 5"
              :key="estrella"
              type="button"
              @click="calificacion = estrella"
              :class="{ seleccionada: estrella <= calificacion }"
              :aria-label="`${estrella} estrellas`"
            >
              ★
            </button>
          </div>

          <p class="instruccion">Cuéntanos cómo fue tu experiencia <small>(opcional)</small></p>

          <textarea
            v-model="comentario"
            placeholder="Escribe aquí tu opinión sobre el destino..."
            rows="5"
            maxlength="1000"
          ></textarea>

          <p class="contador-texto">{{ comentario.length }} / 1000</p>

          <button
            class="boton-publicar"
            :disabled="calificacion === 0 || publicando"
            @click="publicarResena"
          >
            {{ publicando ? 'Publicando…' : 'Publicar reseña' }}
          </button>

        </section>

        <!-- PENDIENTES POR CALIFICAR -->
        <section v-if="porCalificar.length > 0 && !reservaActual" class="bloque-lista">

          <h3 class="subtitulo">Pendientes por calificar</h3>

          <article v-for="r in porCalificar" :key="r.id_reserva" class="resena-card">

            <div class="resena-encabezado">
              <h3>{{ r.servicio.titulo }}</h3>
            </div>

            <p class="fecha">{{ fechaCorta(r.fecha_inicio) }}</p>

            <button class="boton-calificar" @click="calificar(r)">
              Escribir reseña ★
            </button>

          </article>

        </section>

        <!-- RESEÑAS PUBLICADAS -->
        <section v-if="calificadas.length > 0 && !reservaActual" class="bloque-lista">

          <h3 class="subtitulo">Reseñas publicadas</h3>

          <article v-for="r in calificadas" :key="r.id_reserva" class="resena-card">

            <div class="resena-encabezado">
              <h3>{{ r.servicio.titulo }}</h3>
              <span>✓ Publicada</span>
            </div>

            <p class="fecha">Visita del {{ fechaCorta(r.fecha_inicio) }}</p>

          </article>

        </section>

        <!-- CUANDO NO HAY NADA -->
        <div
          v-if="porCalificar.length === 0 && calificadas.length === 0 && !reservaActual"
          class="vacio"
        >

          <span class="vacio-icono">✧</span>

          <h3>Aún no tienes reseñas</h3>

          <p>
            Cuando termines una experiencia reservada, podrás compartir
            tu opinión y calificarla.
          </p>

          <button @click="router.push('/mis-reservas')">
            Ver mis reservas →
          </button>

        </div>

      </template>

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

      <button class="nav-item activo" @click="router.push('/perfil')">
        <span>♙</span>
        <small>Perfil</small>
      </button>

    </nav>

  </main>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { listarReservas, obtenerReserva, crearResena } from '../services/reservas'
import { mensajeError } from '../services/api'
import { fechaCorta } from '../utils/formato'

const router = useRouter()
const route = useRoute()

const porCalificar = ref([])
const calificadas = ref([])

const reservaActual = ref(null)

const calificacion = ref(0)
const comentario = ref('')

const cargando = ref(true)
const publicando = ref(false)
const error = ref('')
const exito = ref('')


// CARGAR INFORMACIÓN
// Solo se pueden calificar reservas COMPLETADAS y pagadas (RF-29): las completa el backend solo

async function cargarListas() {
  const r = await listarReservas({ estado: 'COMPLETADA', limit: 50 })

  porCalificar.value = r.data.filter((x) => !x.calificada && x.estado_pago === 'APROBADO')
  calificadas.value = r.data.filter((x) => x.calificada)
}

async function prepararFormulario() {
  reservaActual.value = null

  const id = route.query.reservaId
  if (!id) return

  try {
    const r = await obtenerReserva(id)

    if (r.estado !== 'COMPLETADA' || r.estado_pago !== 'APROBADO') {
      error.value = 'Solo puedes calificar experiencias que ya terminaron y fueron pagadas.'
    } else if (r.calificada) {
      error.value = 'Esta reserva ya tiene una reseña.'
    } else {
      reservaActual.value = {
        id_reserva: r.id_reserva,
        id_servicio: r.id_servicio,
        destino: r.servicio.titulo
      }
    }
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos abrir la reserva.')
  }
}

async function iniciar() {
  cargando.value = true
  error.value = ''

  try {
    await cargarListas()
    await prepararFormulario()
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos cargar tus reseñas.')
  } finally {
    cargando.value = false
  }
}

onMounted(iniciar)

// Si se toca "Escribir reseña" estando ya en esta pantalla
watch(() => route.query.reservaId, async () => {
  if (route.name === 'Resenas') await prepararFormulario()
})

function calificar(reserva) {
  exito.value = ''
  error.value = ''
  router.replace({ path: '/resenas', query: { reservaId: reserva.id_reserva } })
}


// PUBLICAR RESEÑA

async function publicarResena() {

  if (!reservaActual.value || calificacion.value === 0 || publicando.value) return

  publicando.value = true
  error.value = ''

  try {

    await crearResena(reservaActual.value.id_servicio, {
      id_reserva: reservaActual.value.id_reserva,
      puntuacion: calificacion.value,
      comentario: comentario.value.trim() || null
    })

    // LIMPIAR FORMULARIO
    reservaActual.value = null
    calificacion.value = 0
    comentario.value = ''

    exito.value = '¡Tu reseña se publicó correctamente!'

    await router.replace('/resenas')
    await cargarListas()

  } catch (e) {

    error.value = mensajeError(e, 'No pudimos publicar tu reseña.')

  } finally {

    publicando.value = false

  }

}

// NAVEGACIÓN

function irMapa() {
  router.push('/mapa')
}

</script>

<style scoped>
.resenas-page {
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
.contenido {
  padding: 20px 22px;
}

.titulo h2 {
  font-family: Georgia, serif;
  font-size: 29px;
  font-weight: normal;
  margin-bottom: 9px;
}

.titulo p {
  color: #89897f;
  font-size: 12px;
  line-height: 1.5;
}

/* RESUMEN */
.resumen {
  display: flex;
  align-items: center;
  gap: 13px;
  background: white;
  padding: 15px;
  border-radius: 12px;
  margin-top: 25px;
  border: 1px solid #eeede7;
}

.resumen-icono {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #edf1e9;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a28b45;
  font-size: 21px;
}

.resumen h3 {
  font-family: Georgia, serif;
  font-size: 16px;
  font-weight: normal;
  margin-bottom: 5px;
}

.resumen p {
  color: #89897f;
  font-size: 10px;
}

/* ESTADO VACÍO */
.vacio {
  margin-top: 25px;
  padding: 35px 20px;
  background: white;
  border: 1px solid #eeede7;
  border-radius: 13px;
  text-align: center;
}

.vacio-icono {
  display: block;
  font-size: 38px;
  color: #66806a;
  margin-bottom: 12px;
}

.vacio h3 {
  font-family: Georgia, serif;
  font-size: 20px;
  font-weight: normal;
  margin-bottom: 10px;
}

.vacio p {
  color: #89897f;
  font-size: 11px;
  line-height: 1.6;
  margin-bottom: 20px;
}

.vacio button {
  background: #28523d;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 11px 17px;
  font-size: 11px;
}

/* TARJETAS DE RESEÑAS */
.resena-card {
  background: white;
  padding: 16px;
  border-radius: 12px;
  margin-top: 15px;
  border: 1px solid #eeede7;
}

.resena-encabezado {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.resena-encabezado h3 {
  font-family: Georgia, serif;
  font-weight: normal;
  font-size: 17px;
}

.resena-encabezado span {
  color: #a28b45;
  font-size: 11px;
  white-space: nowrap;
}

.fecha {
  color: #999;
  font-size: 10px;
  margin-top: 7px;
}

.comentario {
  font-size: 12px;
  line-height: 1.5;
  margin-top: 12px;
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

/* FORMULARIO DE RESEÑAS */

.formulario-resena {
  margin-top: 25px;
  padding: 20px;
  background: white;
  border: 1px solid #eeede7;
  border-radius: 13px;
}

.formulario-resena h3 {
  font-family: Georgia, serif;
  font-size: 20px;
  font-weight: normal;
  margin-bottom: 8px;
}

.destino-resena {
  color: #28523d;
  font-size: 13px;
  margin-bottom: 20px;
}

.instruccion {
  color: #77776f;
  font-size: 12px;
  margin: 15px 0 10px;
}

/* ESTRELLAS */

.estrellas {
  display: flex;
  gap: 8px;
}

.estrellas button {
  border: none;
  background: transparent;
  color: #d6d3c9;
  font-size: 30px;
  cursor: pointer;
  padding: 0;
}

.estrellas button.seleccionada {
  color: #c4a34f;
}

/* COMENTARIO */

.formulario-resena textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #e5e3da;
  border-radius: 8px;
  resize: vertical;
  font-family: Arial, sans-serif;
  font-size: 12px;
  outline: none;
  box-sizing: border-box;
}

.formulario-resena textarea:focus {
  border-color: #28523d;
}

/* PUBLICAR */

.boton-publicar {
  width: 100%;
  margin-top: 15px;
  padding: 13px;
  border: none;
  border-radius: 8px;
  background: #28523d;
  color: white;
  font-size: 12px;
  cursor: pointer;
}

.boton-publicar:disabled {
  background: #aeb9ad;
  cursor: not-allowed;
}

/* ===== CONEXIÓN CON LA API ===== */
.subtitulo {
  font-family: Georgia, serif;
  font-weight: normal;
  font-size: 17px;
  margin: 22px 0 12px;
  color: #263b30;
}

.contador-texto {
  text-align: right;
  font-size: 10px;
  color: #9a9a90;
  margin: 4px 0 12px;
}

.instruccion small {
  color: #9a9a90;
}

.boton-publicar:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.boton-calificar {
  width: 100%;
  margin-top: 12px;
  padding: 11px;
  border: none;
  border-radius: 8px;
  background: #28523d;
  color: white;
  font-size: 11px;
}

.resena-encabezado span {
  font-size: 11px;
  color: #28523d;
}

.contenido .aviso-ok,
.contenido .aviso-error {
  margin: 0 0 16px;
}

</style>
