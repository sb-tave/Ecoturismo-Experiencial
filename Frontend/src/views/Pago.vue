<template>
  <main class="pago-page">

    <!-- ENCABEZADO -->
    <header class="pago-header">

      <button class="volver" @click="salir" aria-label="Volver">
        ←
      </button>

      <div>
        <small>RAÍZ · PAGO</small>
        <h1>{{ titulo }}</h1>
        <p>{{ subtitulo }}</p>
      </div>

    </header>


    <!-- CARGANDO -->
    <div v-if="cargando" class="bloque-cargando">
      <span class="spinner"></span> Cargando tu reserva…
    </div>


    <!-- NO SE PUDO CARGAR -->
    <section v-else-if="!reserva" class="estado-final">

      <div class="estado-icono cancelada">!</div>

      <h2>{{ errorCarga || 'Reserva no encontrada' }}</h2>

      <button v-if="errorCarga" class="btn-secundario" @click="cargar">Reintentar</button>

      <button class="btn-primario" @click="router.push('/mis-reservas')">
        Ir a mis reservas
      </button>

    </section>


    <template v-else>

      <!-- TEMPORIZADOR: el cupo se libera si no se paga a tiempo (RF-22) -->
      <section
        v-if="estado === 'PENDIENTE_PAGO' && !vencida"
        class="temporizador"
        :class="{ urgente: segundos < 120 }"
      >

        <div class="temporizador-texto">
          <span>Tu cupo está reservado por</span>
          <strong>{{ mmss(segundos) }}</strong>
        </div>

        <div class="barra">
          <div class="barra-progreso" :style="{ width: porcentaje + '%' }"></div>
        </div>

      </section>


      <!-- RESUMEN DE LA RESERVA -->
      <section class="resumen-pago">

        <h2>Tu reserva</h2>

        <div class="fila">
          <span>Código</span>
          <strong>{{ reserva.codigo }}</strong>
        </div>

        <div class="fila">
          <span>Experiencia</span>
          <strong>{{ reserva.servicio?.titulo }}</strong>
        </div>

        <div class="fila">
          <span>{{ reserva.servicio?.tipo === 'ALOJAMIENTO' ? 'Estadía' : 'Fecha' }}</span>
          <strong>{{ fechas }}</strong>
        </div>

        <div class="fila">
          <span>Personas</span>
          <strong>{{ reserva.num_personas }}</strong>
        </div>

        <div class="fila total">
          <span>Total a pagar</span>
          <strong>{{ dinero(reserva.precio_total) }}</strong>
        </div>

      </section>


      <!-- ========== PAGO APROBADO ========== -->
      <section v-if="estado === 'CONFIRMADA' || estado === 'COMPLETADA'" class="estado-final">

        <div class="estado-icono ok">✓</div>

        <h2>{{ estado === 'CONFIRMADA' ? '¡Reserva confirmada!' : 'Experiencia realizada' }}</h2>

        <p class="estado-texto">
          Tu pago fue aprobado. Te avisamos en tus notificaciones y el anfitrión ya sabe que vienes.
        </p>

        <p v-if="pagoAprobado" class="referencia">
          Referencia de pago <strong>{{ pagoAprobado.referencia_pasarela }}</strong>
        </p>

        <button class="btn-primario" @click="router.push('/mis-reservas')">
          Ver mis reservas →
        </button>

        <button class="btn-secundario" @click="router.push('/explorar')">
          Seguir explorando
        </button>

      </section>


      <!-- ========== RESERVA CANCELADA O VENCIDA ========== -->
      <section v-else-if="estado === 'CANCELADA' || vencida" class="estado-final">

        <div class="estado-icono cancelada">{{ vencida || expiroPorTiempo ? '⏱' : '✕' }}</div>

        <h2>{{ vencida || expiroPorTiempo ? 'Se acabó el tiempo' : 'Reserva cancelada' }}</h2>

        <p class="estado-texto">
          <template v-if="vencida || expiroPorTiempo">
            No recibimos el pago a tiempo y el cupo volvió a quedar disponible.
          </template>
          <template v-else>
            Liberamos tu cupo. Puedes buscar otra fecha cuando quieras.
          </template>
        </p>

        <button
          class="btn-primario"
          @click="router.push(`/destino/${reserva.id_servicio}`)"
        >
          Reservar de nuevo →
        </button>

        <button class="btn-secundario" @click="router.push('/explorar')">
          Volver a explorar
        </button>

      </section>


      <!-- ========== PENDIENTE DE PAGO ========== -->
      <template v-else>

        <!-- MEDIO DE PAGO -->
        <section class="metodos">

          <h2>Medio de pago</h2>

          <button
            v-for="m in metodos"
            :key="m.id"
            type="button"
            class="metodo"
            :class="{ activo: metodo === m.id }"
            :disabled="procesando"
            @click="metodo = m.id"
          >
            <span class="metodo-icono">{{ m.icono }}</span>

            <span class="metodo-texto">
              <strong>{{ m.titulo }}</strong>
              <small>{{ m.detalle }}</small>
            </span>

            <span class="radio" :class="{ marcado: metodo === m.id }"></span>
          </button>

          <p class="aviso-info">
            🔒 Esta es una pasarela de pagos <strong>simulada</strong>: no pedimos ni guardamos
            datos de tu tarjeta ni de tu cuenta. El valor lo calcula el servidor.
          </p>

          <!-- Solo para demostraciones -->
          <div v-if="modoDemo" class="demo">
            <label for="resultado">Resultado de la simulación (demo)</label>

            <select id="resultado" v-model="resultadoDemo" :disabled="procesando">
              <option value="">Aleatorio (90 % aprobado)</option>
              <option value="APROBADO">Forzar pago aprobado</option>
              <option value="RECHAZADO">Forzar pago rechazado</option>
            </select>
          </div>

        </section>


        <!-- INTENTOS ANTERIORES -->
        <section v-if="pagos.length" class="intentos">

          <h2>Intentos de pago</h2>

          <div v-for="p in pagos" :key="p.id_pago" class="intento">
            <span :class="['punto', p.estado === 'APROBADO' ? 'ok' : 'mal']"></span>

            <div>
              <strong>{{ p.estado === 'APROBADO' ? 'Aprobado' : 'Rechazado' }}</strong>
              <small>{{ fechaHora(p.fecha_pago) }} · {{ p.referencia_pasarela }}</small>
            </div>
          </div>

        </section>


        <p v-if="errorPago" class="aviso-error">{{ errorPago }}</p>


        <!-- BOTONES -->
        <button
          class="btn-primario btn-pagar"
          :disabled="procesando"
          @click="pagar"
        >
          <span v-if="procesando" class="spinner blanco"></span>
          {{ procesando ? 'Procesando pago…' : `Pagar ${dinero(reserva.precio_total)}` }}
        </button>

        <button
          class="btn-peligro"
          :disabled="procesando"
          @click="modalCancelar = true"
        >
          Cancelar reserva
        </button>

        <p class="nota">
          Al pagar aceptas las condiciones de la reserva. Si no pagas a tiempo, el cupo se libera solo.
        </p>

      </template>

    </template>


    <!-- CONFIRMAR CANCELACIÓN -->
    <ConfirmarModal
      :abierto="modalCancelar"
      titulo="¿Cancelar esta reserva?"
      mensaje="Liberaremos tu cupo y no se te cobrará nada. Esta acción no se puede deshacer."
      texto-confirmar="Sí, cancelar"
      texto-cancelar="No, mantener"
      peligro
      :cargando="cancelando"
      @confirmar="cancelar"
      @cancelar="modalCancelar = false"
    />

  </main>
</template>


<script setup>

import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ConfirmarModal from '../components/ConfirmarModal.vue'
import { obtenerReserva, simularPago, cancelarReserva } from '../services/reservas'
import { mensajeError, codigoError } from '../services/api'
import { dinero, fechaLarga, fechaCorta, fechaHora, mmss } from '../utils/formato'

const route = useRoute()
const router = useRouter()


// RESERVA

const reserva = ref(null)
const pagos = ref([])
const cargando = ref(true)
const errorCarga = ref('')

const estado = computed(() => reserva.value?.estado)

const pagoAprobado = computed(() => pagos.value.find((p) => p.estado === 'APROBADO'))

const fechas = computed(() => {
  const r = reserva.value
  if (!r) return ''
  return r.fecha_inicio === r.fecha_fin
    ? fechaLarga(r.fecha_inicio)
    : `${fechaCorta(r.fecha_inicio)} → ${fechaCorta(r.fecha_fin)}`
})

async function cargar() {
  cargando.value = true
  errorCarga.value = ''

  try {
    await refrescar()
  } catch (e) {
    reserva.value = null
    errorCarga.value = codigoError(e) === 'NO_ENCONTRADO' ? '' : mensajeError(e, 'No pudimos cargar tu reserva.')
  } finally {
    cargando.value = false
  }
}

// Trae la reserva actualizada (con sus intentos de pago)
async function refrescar() {
  const r = await obtenerReserva(route.params.id)
  reserva.value = r
  pagos.value = r.pagos || []
}

onMounted(() => {
  cargar()
  reloj = setInterval(() => { ahora.value = Date.now() }, 1000)
})


// TEMPORIZADOR

const ahora = ref(Date.now())
let reloj = null

onBeforeUnmount(() => clearInterval(reloj))

const segundos = computed(() => {
  if (!reserva.value?.expira_en) return 0
  return Math.floor((Date.parse(reserva.value.expira_en) - ahora.value) / 1000)
})

const porcentaje = computed(() => {
  const r = reserva.value
  if (!r?.expira_en || !r?.fecha_creacion) return 0
  const total = (Date.parse(r.expira_en) - Date.parse(r.fecha_creacion)) / 1000
  return total > 0 ? Math.max(0, Math.min(100, (segundos.value / total) * 100)) : 0
})

const expiroPorTiempo = ref(false)

const vencida = computed(() => estado.value === 'PENDIENTE_PAGO' && segundos.value <= 0)

// Cuando el reloj llega a cero se consulta al servidor, que es quien decide si venció
watch(vencida, async (esVencida) => {
  if (!esVencida) return
  expiroPorTiempo.value = true
  try { await refrescar() } catch { /* se mantiene la vista de tiempo agotado */ }
})


// TEXTOS DE LA PANTALLA

const titulo = computed(() => {
  if (!reserva.value) return 'Pago de tu reserva'
  if (estado.value === 'CONFIRMADA') return 'Pago aprobado.'
  if (estado.value === 'COMPLETADA') return 'Reserva realizada.'
  if (estado.value === 'CANCELADA' || vencida.value) return expiroPorTiempo.value || vencida.value ? 'Tiempo agotado.' : 'Reserva cancelada.'
  return 'Completa tu pago.'
})

const subtitulo = computed(() => {
  if (estado.value === 'PENDIENTE_PAGO' && !vencida.value) return 'Elige cómo quieres pagar para confirmar tu cupo.'
  return 'Resumen de tu reserva.'
})


// MEDIO DE PAGO

const metodos = [
  { id: 'TARJETA_SIMULADA', icono: '▭', titulo: 'Tarjeta débito o crédito', detalle: 'Pago simulado inmediato' },
  { id: 'TRANSFERENCIA_SIMULADA', icono: '⇄', titulo: 'Transferencia bancaria', detalle: 'Transferencia simulada' }
]

const metodo = ref('TARJETA_SIMULADA')

// Selector de resultado: solo en desarrollo o si se activa VITE_PAGO_DEMO (el backend además debe permitirlo)
const modoDemo = import.meta.env.DEV || import.meta.env.VITE_PAGO_DEMO === 'true'
const resultadoDemo = ref('')


// PAGAR

const procesando = ref(false)
const errorPago = ref('')

async function pagar() {

  if (procesando.value || vencida.value) return

  errorPago.value = ''
  procesando.value = true

  try {

    const r = await simularPago({
      id_reserva: reserva.value.id_reserva,
      metodo: metodo.value,
      resultado: modoDemo ? resultadoDemo.value : ''
    })

    pagos.value = [...pagos.value, r.pago]
    reserva.value = { ...reserva.value, ...r.reserva }

    if (r.pago.estado === 'RECHAZADO') {
      errorPago.value = 'Tu pago fue rechazado. Puedes intentarlo de nuevo o elegir otro medio de pago.'
    }

  } catch (e) {

    const codigo = codigoError(e)

    if (codigo === 'RESERVA_EXPIRADA') {

      // El backend canceló la reserva y liberó el cupo
      expiroPorTiempo.value = true
      await refrescar().catch(() => {})

    } else if (codigo === 'RESERVA_NO_PAGABLE') {

      // La reserva cambió de estado (por ejemplo, ya estaba pagada): se muestra su estado real
      await refrescar().catch(() => {})

    } else {

      errorPago.value = mensajeError(e, 'No pudimos procesar el pago. Inténtalo de nuevo.')

    }

  } finally {

    procesando.value = false

  }

}


// CANCELAR

const modalCancelar = ref(false)
const cancelando = ref(false)

async function cancelar() {

  cancelando.value = true

  try {
    await cancelarReserva(reserva.value.id_reserva)
    expiroPorTiempo.value = false
    await refrescar()
  } catch (e) {
    errorPago.value = mensajeError(e, 'No pudimos cancelar la reserva.')
  } finally {
    cancelando.value = false
    modalCancelar.value = false
  }

}


// NAVEGACIÓN

function salir() {
  router.push('/mis-reservas')
}

</script>


<style scoped>

.pago-page {
  width: 100%;
  max-width: 430px;
  min-height: 100vh;
  margin: 0 auto;
  padding: 20px 20px 40px;
  background: #f7f6f0;
  color: #263b30;
}

/* ENCABEZADO */

.pago-header {
  display: flex;
  align-items: flex-start;
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

.pago-header small {
  font-size: 8px;
  letter-spacing: 1px;
  color: #8a8c80;
}

.pago-header h1 {
  font-family: Georgia, serif;
  font-weight: normal;
  font-size: 25px;
  line-height: 1.15;
  margin: 7px 0;
}

.pago-header p {
  font-size: 11px;
  color: #85877e;
}

/* TEMPORIZADOR */

.temporizador {
  background: #eaf0e6;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 16px;
}

.temporizador.urgente {
  background: #fbefe3;
}

.temporizador-texto {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #52644f;
}

.temporizador-texto strong {
  font-family: Georgia, serif;
  font-weight: normal;
  font-size: 24px;
  color: #28523d;
  font-variant-numeric: tabular-nums;
}

.urgente .temporizador-texto,
.urgente .temporizador-texto strong {
  color: #a1581b;
}

.barra {
  height: 5px;
  background: rgba(40, 82, 61, 0.15);
  border-radius: 3px;
  margin-top: 10px;
  overflow: hidden;
}

.barra-progreso {
  height: 100%;
  background: #28523d;
  border-radius: 3px;
  transition: width 1s linear;
}

.urgente .barra-progreso {
  background: #c97a2b;
}

/* RESUMEN */

.resumen-pago,
.metodos,
.intentos {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 3px 12px rgba(35, 55, 40, 0.06);
}

.resumen-pago h2,
.metodos h2,
.intentos h2 {
  font-family: Georgia, serif;
  font-weight: normal;
  font-size: 18px;
  margin-bottom: 12px;
}

.fila {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 9px 0;
  border-bottom: 1px solid #f0eee6;
  font-size: 12px;
}

.fila span {
  color: #8a8c80;
}

.fila strong {
  font-weight: normal;
  text-align: right;
  text-transform: none;
}

.fila:last-child {
  border-bottom: none;
}

.fila.total {
  margin-top: 4px;
  padding-top: 14px;
  border-top: 1px solid #e3e1d8;
  border-bottom: none;
}

.fila.total span {
  color: #263b30;
  font-size: 13px;
}

.fila.total strong {
  font-family: Georgia, serif;
  font-size: 20px;
  color: #28523d;
}

/* MEDIOS DE PAGO */

.metodo {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px;
  margin-bottom: 9px;
  border: 1.5px solid #e4e2d9;
  border-radius: 11px;
  background: #fdfdfb;
  color: inherit;
  text-align: left;
}

.metodo.activo {
  border-color: #28523d;
  background: #f1f6ee;
}

.metodo:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.metodo-icono {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: #e9ede4;
  color: #31543d;
  font-size: 18px;
}

.metodo-texto {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.metodo-texto strong {
  font-weight: normal;
  font-size: 13px;
}

.metodo-texto small {
  font-size: 10.5px;
  color: #8a8c80;
}

.radio {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border: 2px solid #c8cbbf;
  border-radius: 50%;
}

.radio.marcado {
  border-color: #28523d;
  background: radial-gradient(circle, #28523d 0 4px, transparent 5px);
}

.metodos .aviso-info {
  margin: 14px 0 0;
}

.demo {
  margin-top: 12px;
  padding: 11px 12px;
  border: 1px dashed #d4cba9;
  border-radius: 9px;
  background: #faf6e6;
}

.demo label {
  display: block;
  font-size: 10.5px;
  color: #8a7b3c;
  margin-bottom: 6px;
}

.demo select {
  width: 100%;
  height: 38px;
  border: 1px solid #deded5;
  border-radius: 8px;
  padding: 0 10px;
  background: white;
  font-size: 12px;
  color: #263b30;
}

/* INTENTOS */

.intento {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 8px 0;
  font-size: 12px;
}

.intento div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.intento strong {
  font-weight: normal;
}

.intento small {
  font-size: 10.5px;
  color: #8a8c80;
}

.punto {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}

.punto.ok { background: #3c8a57; }
.punto.mal { background: #c0463f; }

/* BOTONES */

.btn-pagar {
  margin-bottom: 10px;
  height: 50px;
  font-size: 14px;
}

.nota {
  margin-top: 14px;
  text-align: center;
  font-size: 10.5px;
  color: #8a8c80;
  line-height: 1.5;
}

/* ESTADOS FINALES */

.estado-final {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 10px 0 0;
}

.estado-icono {
  width: 66px;
  height: 66px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  color: white;
  margin: 6px 0 2px;
}

.estado-icono.ok { background: #3c8a57; }
.estado-icono.cancelada { background: #b6b3a5; }

.estado-final h2 {
  font-family: Georgia, serif;
  font-weight: normal;
  font-size: 23px;
}

.estado-texto {
  font-size: 12px;
  line-height: 1.55;
  color: #6f7168;
  max-width: 320px;
}

.referencia {
  font-size: 11px;
  color: #6f7168;
  background: #eef2ea;
  border-radius: 8px;
  padding: 9px 14px;
}

.referencia strong {
  color: #28523d;
  letter-spacing: 0.5px;
}

.estado-final .btn-primario,
.estado-final .btn-secundario {
  margin-top: 2px;
}

</style>
