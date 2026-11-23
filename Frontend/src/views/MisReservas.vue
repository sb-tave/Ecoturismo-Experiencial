<template>
  <main class="mis-reservas">

    <header class="reservas-header">

      <button @click="router.push('/explorar')">
        ← Volver
      </button>

      <small>RAÍZ · TUS EXPERIENCIAS</small>

      <h1>Mis reservas</h1>

      <p>
        Aquí encontrarás las experiencias que has reservado.
      </p>

    </header>

    <!-- FILTROS POR ESTADO -->
    <div class="pestanas">
      <button
        v-for="p in pestanas"
        :key="p.valor"
        :class="{ activa: filtro === p.valor }"
        @click="filtro = p.valor"
      >
        {{ p.etiqueta }}
      </button>
    </div>

    <!-- CARGANDO -->
    <div v-if="cargando" class="bloque-cargando">
      <span class="spinner"></span> Cargando tus reservas…
    </div>

    <!-- ERROR -->
    <div v-else-if="error" class="aviso-error lista-aviso">
      {{ error }}
      <button @click="cargar(true)">Reintentar</button>
    </div>

    <!-- CUANDO NO HAY RESERVAS -->

    <section v-else-if="reservas.length === 0" class="sin-reservas">

      <div class="icono-vacio">🌿</div>

      <h2>{{ filtro ? 'No hay reservas en este estado' : 'Aún no tienes reservas' }}</h2>

      <p>
        Explora nuestros destinos y encuentra tu próxima aventura.
      </p>

      <button @click="router.push('/explorar')">
        Explorar destinos →
      </button>

    </section>

    <!-- LISTA DE RESERVAS -->

    <section v-else class="lista-reservas">

      <p v-if="mensaje" class="aviso-ok">{{ mensaje }}</p>

      <article
        v-for="reserva in reservas"
        :key="reserva.id_reserva"
        class="reserva-card"
      >

        <img
          :src="imagenes[reserva.id_servicio] || imagenPorDefecto"
          :alt="reserva.servicio.titulo"
        >

        <div class="reserva-contenido">

          <div class="reserva-titulo">
            <h2>{{ reserva.servicio.titulo }}</h2>
            <span :class="['estado', ESTADOS_RESERVA[reserva.estado].clase]">
              {{ ESTADOS_RESERVA[reserva.estado].etiqueta }}
            </span>
          </div>

          <p class="ubicacion">
            {{ reserva.servicio.localidad }} · {{ reserva.codigo }}
          </p>

          <div class="reserva-detalles">

            <p>
              <strong>{{ reserva.servicio.tipo === 'ALOJAMIENTO' ? 'Estadía:' : 'Fecha:' }}</strong>
              {{ rangoFechas(reserva) }}
            </p>

            <p>
              <strong>Personas:</strong>
              {{ reserva.num_personas }}
            </p>

            <p v-if="reserva.estado !== 'CANCELADA'">
              <strong>Pago:</strong>
              {{ etiquetaPago[reserva.estado_pago] }}
            </p>

          </div>

          <div class="reserva-total">
            <span>{{ reserva.estado_pago === 'APROBADO' ? 'Total pagado' : 'Total' }}</span>
            <strong>
              {{ dinero(reserva.precio_total) }}
            </strong>
          </div>

          <!-- ACCIONES DE LA RESERVA -->

          <div class="reserva-acciones">

            <!-- Pendiente de pago: ir a pagar mientras el cupo esté retenido -->
            <template v-if="reserva.estado === 'PENDIENTE_PAGO'">

              <p v-if="restante(reserva) > 0" class="vence">
                Tu cupo vence en <strong>{{ mmss(restante(reserva)) }}</strong>
              </p>
              <p v-else class="vence vencida">
                El tiempo para pagar terminó. Actualiza la lista.
              </p>

              <button
                v-if="restante(reserva) > 0"
                class="boton-resena"
                @click="router.push(`/pago/${reserva.id_reserva}`)"
              >
                Pagar ahora →
              </button>

            </template>

            <!-- Reseña disponible solo cuando la reserva está completada -->
            <button
              v-else-if="reserva.estado === 'COMPLETADA' && !reserva.calificada"
              class="boton-resena"
              @click="escribirResena(reserva)"
            >
              Escribir reseña ★
            </button>

            <span v-else-if="reserva.calificada" class="resena-realizada">
              ✓ Reseña publicada
            </span>

            <p v-else-if="reserva.estado === 'CONFIRMADA'" class="vence">
              Pago aprobado. Pasará a «Realizada» cuando termine tu experiencia.
            </p>

            <button
              v-if="puedeCancelar(reserva)"
              class="boton-cancelar"
              @click="pedirCancelar(reserva)"
            >
              Cancelar reserva
            </button>

          </div>

        </div>

      </article>

      <button
        v-if="pagina < totalPaginas"
        class="ver-mas"
        :disabled="cargandoMas"
        @click="cargarMas"
      >
        <span v-if="cargandoMas" class="spinner"></span>
        {{ cargandoMas ? 'Cargando…' : 'Ver más reservas' }}
      </button>

    </section>


    <!-- CONFIRMAR CANCELACIÓN -->
    <ConfirmarModal
      :abierto="Boolean(porCancelar)"
      titulo="¿Cancelar esta reserva?"
      :mensaje="mensajeCancelar"
      texto-confirmar="Sí, cancelar"
      texto-cancelar="No, mantener"
      peligro
      :cargando="cancelando"
      @confirmar="cancelar"
      @cancelar="porCancelar = null"
    />

<!-- NAVEGACIÓN INFERIOR -->
<nav class="bottom-nav">

  <button class="nav-item" @click="irExplorar">
    <span>⌂</span>
    <small>Explorar</small>
  </button>

  <button class="nav-item" @click="irMapa">
    <span>⌖</span>
    <small>Mapa</small>
  </button>

  <button class="nav-item activo" @click="irReservas">
    <span>▣</span>
    <small>Mis reservas</small>
  </button>

  <button class="nav-item" @click="irPerfil">
    <span>♙</span>
    <small>Perfil</small>
  </button>

</nav>

  </main>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'

import ConfirmarModal from '../components/ConfirmarModal.vue'
import { listarReservas, cancelarReserva, ESTADOS_RESERVA } from '../services/reservas'
import { obtenerServicio } from '../services/destinos'
import { mensajeError } from '../services/api'
import { dinero, fechaCorta, mmss } from '../utils/formato'
import imagenPorDefecto from '../assets/hero.png'

const router = useRouter()

// NAVEGACIÓN

function irExplorar() {
  router.push('/explorar')
}

function irMapa() {
  router.push('/mapa')
}

function irReservas() {
  router.push('/mis-reservas')
}

function irPerfil() {
  router.push('/perfil')
}


// FILTROS

const pestanas = [
  { valor: '', etiqueta: 'Todas' },
  { valor: 'PENDIENTE_PAGO', etiqueta: 'Por pagar' },
  { valor: 'CONFIRMADA', etiqueta: 'Confirmadas' },
  { valor: 'COMPLETADA', etiqueta: 'Realizadas' },
  { valor: 'CANCELADA', etiqueta: 'Canceladas' }
]

const filtro = ref('')

const etiquetaPago = {
  APROBADO: 'Aprobado',
  PENDIENTE: 'Pendiente',
  RECHAZADO: 'Rechazado',
  SIN_PAGO: 'Sin pago'
}


// DATOS

const POR_PAGINA = 10

const reservas = ref([])
const pagina = ref(1)
const totalPaginas = ref(1)
const imagenes = reactive({}) // id_servicio -> foto principal

const cargando = ref(true)
const cargandoMas = ref(false)
const error = ref('')
const mensaje = ref('')

let ultimaSolicitud = 0

async function cargar(reiniciar = true) {
  const solicitud = ++ultimaSolicitud

  if (reiniciar) cargando.value = true
  error.value = ''

  try {
    const r = await listarReservas({ estado: filtro.value, page: 1, limit: POR_PAGINA })
    if (solicitud !== ultimaSolicitud) return

    reservas.value = r.data
    pagina.value = 1
    totalPaginas.value = r.meta.total_pages

    cargarImagenes(r.data)
  } catch (e) {
    if (solicitud !== ultimaSolicitud) return
    error.value = mensajeError(e, 'No pudimos cargar tus reservas.')
  } finally {
    if (solicitud === ultimaSolicitud) cargando.value = false
  }
}

async function cargarMas() {
  if (cargandoMas.value) return

  cargandoMas.value = true

  try {
    const r = await listarReservas({ estado: filtro.value, page: pagina.value + 1, limit: POR_PAGINA })

    reservas.value = [...reservas.value, ...r.data]
    pagina.value += 1
    totalPaginas.value = r.meta.total_pages

    cargarImagenes(r.data)
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos cargar más reservas.')
  } finally {
    cargandoMas.value = false
  }
}

// La lista de reservas no trae fotos: se piden una sola vez por servicio
async function cargarImagenes(lista) {
  const ids = [...new Set(lista.map((r) => r.id_servicio))].filter((id) => !(id in imagenes))

  await Promise.all(ids.map(async (id) => {
    try {
      imagenes[id] = (await obtenerServicio(id)).imagen
    } catch {
      imagenes[id] = imagenPorDefecto
    }
  }))
}

watch(filtro, () => cargar(true))


// TEMPORIZADOR DE LAS RESERVAS PENDIENTES

const ahora = ref(Date.now())
let reloj = null

const restante = (reserva) => {
  return reserva.expira_en ? Math.floor((Date.parse(reserva.expira_en) - ahora.value) / 1000) : 0
}

onMounted(() => {
  cargar(true)
  reloj = setInterval(() => { ahora.value = Date.now() }, 1000)
})

onBeforeUnmount(() => clearInterval(reloj))


// FECHAS

function rangoFechas(reserva) {
  return reserva.fecha_inicio === reserva.fecha_fin
    ? fechaCorta(reserva.fecha_inicio)
    : `${fechaCorta(reserva.fecha_inicio)} → ${fechaCorta(reserva.fecha_fin)}`
}


// CANCELAR (RF-24)

const porCancelar = ref(null)
const cancelando = ref(false)

const puedeCancelar = (reserva) => ['PENDIENTE_PAGO', 'CONFIRMADA'].includes(reserva.estado)

const mensajeCancelar = computed(() => {
  if (!porCancelar.value) return ''
  return porCancelar.value.estado === 'CONFIRMADA'
    ? 'Liberaremos tu cupo. Ten en cuenta que esta versión no simula reembolsos. Esta acción no se puede deshacer.'
    : 'Liberaremos tu cupo y no se te cobrará nada. Esta acción no se puede deshacer.'
})

function pedirCancelar(reserva) {
  mensaje.value = ''
  porCancelar.value = reserva
}

async function cancelar() {
  cancelando.value = true

  try {
    await cancelarReserva(porCancelar.value.id_reserva)
    mensaje.value = `La reserva ${porCancelar.value.codigo} fue cancelada.`
    porCancelar.value = null
    await cargar(false)
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos cancelar la reserva.')
    porCancelar.value = null
  } finally {
    cancelando.value = false
  }
}


// ESCRIBIR RESEÑA

function escribirResena(reserva) {

  router.push({
    path: '/resenas',
    query: {
      reservaId: reserva.id_reserva
    }
  })

}
</script>

<style scoped>

.mis-reservas {
  min-height: 100vh;
  background: #f7f6f0;
  padding: 30px 22px 100px;
  max-width: 500px;
  margin: auto;
  color: #303c32;
}

.reservas-header {
  margin-bottom: 30px;
}

.reservas-header button {
  border: none;
  background: transparent;
  color: #28523d;
  font-size: 13px;
  margin-bottom: 35px;
  cursor: pointer;
}

.reservas-header small {
  display: block;
  color: #898a80;
  font-size: 10px;
  letter-spacing: 1px;
  margin-bottom: 12px;
}

.reservas-header h1 {
  font-family: Georgia, serif;
  font-size: 30px;
  font-weight: normal;
  color: #28523d;
}

.reservas-header p {
  font-size: 12px;
  color: #898a80;
  margin-top: 8px;
}

.sin-reservas {
  text-align: center;
  padding: 55px 15px;
}

.icono-vacio {
  font-size: 45px;
  margin-bottom: 20px;
}

.sin-reservas h2 {
  font-family: Georgia, serif;
  font-size: 21px;
  font-weight: normal;
}

.sin-reservas p {
  font-size: 12px;
  color: #898a80;
  line-height: 1.6;
  margin: 12px 0 25px;
}

.sin-reservas button {
  background: #28523d;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 14px 22px;
  cursor: pointer;
}

.lista-reservas {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.reserva-card {
  background: white;
  border-radius: 13px;
  overflow: hidden;
  border: 1px solid #e8e6de;
}

.reserva-card img {
  width: 100%;
  height: 175px;
  object-fit: cover;
}

.reserva-contenido {
  padding: 17px;
}

.reserva-titulo {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.reserva-titulo h2 {
  font-family: Georgia, serif;
  font-size: 19px;
  font-weight: normal;
  color: #28523d;
}

.reserva-titulo span {
  background: #e5eee5;
  color: #28523d;
  border-radius: 20px;
  padding: 6px 9px;
  font-size: 9px;
}

.ubicacion {
  color: #898a80;
  font-size: 11px;
  margin-top: 6px;
}

.reserva-detalles {
  border-top: 1px solid #e8e6de;
  margin-top: 17px;
  padding-top: 13px;
}

.reserva-detalles p {
  font-size: 12px;
  margin-bottom: 9px;
}

.reserva-total {
  border-top: 1px solid #e8e6de;
  margin-top: 15px;
  padding-top: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.reserva-total span {
  font-size: 11px;
  color: #898a80;
}

.reserva-total strong {
  color: #28523d;
  font-size: 17px;
}

/* NAVEGACIÓN INFERIOR */

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 500px;
  height: 70px;
  background: #ffffff;
  border-top: 1px solid #e8e6de;
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 100;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: none;
  background: transparent;
  color: #898a80;
  cursor: pointer;
  flex: 1;
}

.nav-item span {
  font-size: 21px;
}

.nav-item small {
  font-size: 10px;
}

.nav-item.activo {
  color: #28523d;
  font-weight: bold;
}

/* ACCIONES DE LAS RESERVAS */

.reserva-acciones {
  margin-top: 15px;
  padding-top: 13px;
  border-top: 1px solid #e8e6de;
}

.boton-finalizar,
.boton-resena {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 11px;
  cursor: pointer;
}

.boton-finalizar {
  background: #edf1e9;
  color: #28523d;
}

.boton-resena {
  background: #28523d;
  color: white;
}

.resena-realizada {
  display: block;
  text-align: center;
  color: #456b4c;
  font-size: 11px;
  padding: 8px;
}

/* ===== CONEXIÓN CON LA API ===== */
.pestanas {
  display: flex;
  gap: 8px;
  padding: 0 0 16px;
  overflow-x: auto;
  scrollbar-width: none;
}

.pestanas::-webkit-scrollbar {
  display: none;
}

.pestanas button {
  flex-shrink: 0;
  padding: 8px 14px;
  border: 1px solid #e4e2d9;
  border-radius: 20px;
  background: white;
  color: #526254;
  font-size: 11px;
}

.pestanas button.activa {
  background: #28523d;
  border-color: #28523d;
  color: white;
}

.lista-aviso {
  margin: 0 0 14px;
}

.lista-reservas .aviso-ok {
  margin-top: 0;
}

.reserva-titulo span.pendiente { background: #fbefe3; color: #a1581b; }
.reserva-titulo span.confirmada { background: #e5eee5; color: #28523d; }
.reserva-titulo span.completada { background: #e6eaf2; color: #3b4f7a; }
.reserva-titulo span.cancelada { background: #f1e9e9; color: #8d2f2f; }

.reserva-titulo span.estado {
  white-space: nowrap;
  align-self: flex-start;
}

.vence {
  font-size: 11px;
  color: #6f7168;
  margin-bottom: 10px;
  line-height: 1.4;
}

.vence strong {
  color: #a1581b;
  font-variant-numeric: tabular-nums;
}

.vence.vencida {
  color: #8d2f2f;
}

.boton-cancelar {
  width: 100%;
  margin-top: 9px;
  padding: 11px;
  border: 1px solid #e3c4c4;
  border-radius: 8px;
  background: white;
  color: #a33a3a;
  font-size: 11px;
}

.ver-mas {
  width: 100%;
  height: 44px;
  background: white;
  border: 1px solid #d9dccf;
  border-radius: 10px;
  color: #28523d;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.ver-mas:disabled {
  opacity: 0.6;
}

</style>
