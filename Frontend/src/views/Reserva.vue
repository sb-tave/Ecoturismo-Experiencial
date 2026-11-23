<template>
  <main class="reserva-page">

    <!-- CARGANDO -->
    <div v-if="cargando" class="bloque-cargando">
      <span class="spinner"></span> Cargando experiencia…
    </div>

    <!-- SI NO SE ENCUENTRA EL DESTINO O NO SE PUEDE RESERVAR -->
    <div v-else-if="!destino || !reservable" class="no-destino">
      <h2>{{ !destino ? (errorCarga || 'Destino no encontrado') : 'Este destino no recibe reservas' }}</h2>
      <button @click="router.push('/explorar')">
        Volver a explorar
      </button>
    </div>


    <!-- PANTALLA DE RESERVA -->
    <template v-else>

      <!-- ENCABEZADO -->
      <header class="reserva-header">

        <button class="volver" @click="regresar">
          ←
        </button>

        <div>
          <small>RAÍZ · TU PRÓXIMA EXPERIENCIA</small>
          <h1>Haz espacio para lo natural.</h1>
          <p>Elige cuándo venir y con quién compartirlo.</p>
        </div>

      </header>


      <!-- DESTINO SELECCIONADO -->
      <section class="destino-reserva">

        <img
          :src="destino.imagen"
          :alt="destino.nombre"
        >

        <div class="destino-datos">

          <div>
            <h2>{{ destino.nombre }}</h2>
            <p>{{ destino.ubicacion }}</p>
            <span>
              <template v-if="destino.calificacion">★ {{ Number(destino.calificacion).toFixed(1) }} · {{ destino.resenas }} reseñas</template>
              <template v-else>Aún sin reseñas</template>
            </span>
          </div>

          <strong>
            {{ dinero(destino.precio) }}
            <small class="unidad">/ {{ destino.unidadPrecio }}</small>
          </strong>

        </div>

      </section>


      <!-- SELECCIONAR FECHA -->
      <section class="calendario-section">

        <h2>{{ esAlojamiento ? '¿Cuándo nos visitas?' : '¿Cuándo nos visitas?' }}</h2>

        <p class="ayuda">
          <template v-if="esAlojamiento">Toca primero tu día de entrada y luego el de salida.</template>
          <template v-else>Selecciona el día de tu experiencia.</template>
        </p>


        <!-- CAMBIAR DE MES -->
        <div class="mes-header">

          <button
            @click="cambiarMes(-1)"
            :disabled="esMesActual"
            aria-label="Mes anterior"
          >
            ‹
          </button>

          <strong>{{ mesTexto }}</strong>

          <button @click="cambiarMes(1)" aria-label="Mes siguiente">
            ›
          </button>

        </div>


        <!-- DÍAS DE LA SEMANA -->
        <div class="calendario-grid" :class="{ cargando: cargandoDisp }">

          <div
            v-for="dia in diasSemana"
            :key="dia"
            class="dia-semana"
          >
            {{ dia }}
          </div>


          <!-- DÍAS DEL CALENDARIO -->
          <template
            v-for="(celda, index) in calendario"
            :key="index"
          >

            <div
              v-if="celda === null"
              class="dia-vacio"
            ></div>

            <button
              v-else
              class="dia"
              :class="{
                seleccionado: esExtremo(celda.fecha),
                'en-rango': enRango(celda.fecha),
                deshabilitado: !diaHabilitado(celda.fecha)
              }"
              :disabled="!diaHabilitado(celda.fecha)"
              @click="seleccionarFecha(celda.fecha)"
            >
              {{ celda.dia }}
            </button>

          </template>

        </div>

        <p class="leyenda">
          <span v-if="cargandoDisp"><span class="spinner"></span> Consultando disponibilidad…</span>
          <span v-else>Los días en gris no tienen cupos disponibles.</span>
        </p>


        <!-- FECHA ELEGIDA -->
        <div
          v-if="fechaInicio && (!esAlojamiento || fechaFin)"
          class="fecha-elegida"
        >
          <span>✓</span>

          <template v-if="esAlojamiento">
            Entrada <strong>{{ fechaCorta(fechaInicio) }}</strong>
            · Salida <strong>{{ fechaCorta(fechaFin) }}</strong>
            ({{ noches }} {{ noches === 1 ? 'noche' : 'noches' }})
          </template>

          <template v-else>
            Fecha seleccionada:
            <strong>{{ fechaLarga(fechaInicio) }}</strong>
          </template>
        </div>

        <div v-else-if="esAlojamiento && fechaInicio" class="fecha-elegida">
          <span>•</span>
          Entrada <strong>{{ fechaCorta(fechaInicio) }}</strong> · ahora elige tu día de salida
        </div>

      </section>


      <!-- ADULTOS Y NIÑOS -->

      <section class="visitantes-section">

        <div class="visitante-fila">

          <div class="visitante-texto">
            <h2>Adultos</h2>
            <p>18 años o más</p>
          </div>

          <div class="contador">

            <button
              type="button"
              @click="disminuirAdultos"
              :disabled="adultos <= 1"
            >
              −
            </button>

            <strong>{{ adultos }}</strong>

            <button
              type="button"
              @click="aumentarAdultos"
              :disabled="visitantes >= maxVisitantes"
            >
              +
            </button>

          </div>

        </div>

        <div class="visitante-fila">

          <div class="visitante-texto">
            <h2>Niños</h2>
            <p>Menores de 18 años</p>
          </div>

          <div class="contador">

            <button
              type="button"
              @click="disminuirNinos"
              :disabled="ninos <= 0"
            >
              −
            </button>

            <strong>{{ ninos }}</strong>

            <button
              type="button"
              @click="aumentarNinos"
              :disabled="visitantes >= maxVisitantes"
            >
              +
            </button>

          </div>

        </div>

        <p class="total-visitantes">
          Total de visitantes: {{ visitantes }} (máximo {{ maxVisitantes }})
        </p>

      </section>


      <!-- RESUMEN DE LA RESERVA -->
      <section class="resumen">

        <h2>Resumen de tu reserva</h2>

        <div class="resumen-linea">
          <span>Visitantes</span>
          <strong>{{ adultos }} adultos · {{ ninos }} niños</strong>
        </div>

        <div class="resumen-linea">
          <span>{{ esAlojamiento ? 'Estadía' : 'Fecha' }}</span>
          <strong>
            <template v-if="esAlojamiento">
              {{ fechaFin ? `${fechaCorta(fechaInicio)} → ${fechaCorta(fechaFin)}` : 'Sin seleccionar' }}
            </template>
            <template v-else>
              {{ fechaInicio ? fechaLarga(fechaInicio) : 'Sin seleccionar' }}
            </template>
          </strong>
        </div>

        <div v-if="listoParaCalcular" class="resumen-fila">
          <span>
            {{ dinero(destino.precio) }} ×
            <template v-if="esAlojamiento">{{ noches }} {{ noches === 1 ? 'noche' : 'noches' }}</template>
            <template v-else>{{ visitantes }} {{ visitantes === 1 ? 'persona' : 'personas' }}</template>
          </span>
          <strong>{{ dinero(total) }}</strong>
        </div>

        <div class="total-linea">
          <span>Total estimado</span>
          <strong>
            {{ listoParaCalcular ? dinero(total) : '—' }}
          </strong>
        </div>

        <p v-if="esAlojamiento" class="nota-precio">
          El precio del alojamiento es por noche y no cambia según el número de personas.
        </p>

        <p class="nota-precio">
          El valor final lo confirma el servidor al crear la reserva.
        </p>

      </section>


      <!-- MENSAJE DE ERROR -->
      <p v-if="error" class="mensaje-error">
        {{ error }}
      </p>


      <!-- BOTÓN CONTINUAR AL PAGO -->
      <button
        class="confirmar-button"
        :disabled="enviando"
        @click="confirmarReserva"
      >
        <span v-if="enviando" class="spinner blanco"></span>
        {{ enviando ? 'Reservando cupo…' : 'Continuar al pago →' }}
      </button>

      <p class="nota">
        Retendremos tu cupo unos minutos mientras completas el pago.
      </p>

    </template>

  </main>
</template>


<script setup>

import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { obtenerServicio, obtenerDisponibilidad } from '../services/destinos'
import { crearReserva } from '../services/reservas'
import { mensajeError, codigoError, detallesError } from '../services/api'
import { dinero, fechaCorta, fechaLarga, aISO, sumarDias, diferenciaDias } from '../utils/formato'


const router = useRouter()
const route = useRoute()

const MAX_NOCHES = 30 // el backend limita la estadía (MAX_STAY_DAYS)


// DESTINO SELECCIONADO

const destino = ref(null)
const cargando = ref(true)
const errorCarga = ref('')

const esAlojamiento = computed(() => destino.value?.tipo === 'ALOJAMIENTO')
const reservable = computed(() => destino.value && destino.value.tipo !== 'NEGOCIO_LOCAL')

onMounted(async () => {
  try {
    destino.value = await obtenerServicio(route.params.id)

    if (reservable.value) await cargarMes(mesActual.value)
  } catch (e) {
    errorCarga.value = codigoError(e) === 'NO_ENCONTRADO' ? '' : mensajeError(e, 'No pudimos cargar el destino.')
  } finally {
    cargando.value = false
  }
})


// FECHAS

const hoy = new Date()
const hoyString = aISO(hoy)

const mesActual = ref(new Date(hoy.getFullYear(), hoy.getMonth(), 1))

const diasSemana = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const mesTexto = computed(() => {
  return mesActual.value.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
})

const esMesActual = computed(() => {
  return (
    mesActual.value.getMonth() === hoy.getMonth() &&
    mesActual.value.getFullYear() === hoy.getFullYear()
  )
})

const calendario = computed(() => {

  const año = mesActual.value.getFullYear()
  const mes = mesActual.value.getMonth()

  const espacios = (new Date(año, mes, 1).getDay() + 6) % 7
  const cantidadDias = new Date(año, mes + 1, 0).getDate()

  const dias = []

  for (let i = 0; i < espacios; i++) dias.push(null)

  for (let dia = 1; dia <= cantidadDias; dia++) {
    dias.push({ dia, fecha: aISO(new Date(año, mes, dia)) })
  }

  return dias

})

function cambiarMes(direccion) {

  mesActual.value = new Date(
    mesActual.value.getFullYear(),
    mesActual.value.getMonth() + direccion,
    1
  )

  cargarMes(mesActual.value)

}


// DISPONIBILIDAD (cupos por día que entrega el backend)

const cupos = reactive({})          // { 'AAAA-MM-DD': cupos_disponibles }
const mesesCargados = new Set()
const cargandoDisp = ref(false)

async function cargarMes(primerDia, forzar = false) {

  const año = primerDia.getFullYear()
  const mes = primerDia.getMonth()
  const clave = `${año}-${String(mes + 1).padStart(2, '0')}`

  if (!forzar && mesesCargados.has(clave)) return

  const desde = aISO(new Date(año, mes, 1)) < hoyString ? hoyString : aISO(new Date(año, mes, 1))
  const hasta = aISO(new Date(año, mes + 1, 0))

  cargandoDisp.value = true

  try {
    const r = await obtenerDisponibilidad(destino.value.id, desde, hasta)

    Object.keys(cupos).filter((f) => f.startsWith(clave)).forEach((f) => delete cupos[f])
    r.dias.forEach((d) => { cupos[d.fecha] = d.cupos_disponibles })

    mesesCargados.add(clave)
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos consultar la disponibilidad.')
  } finally {
    cargandoDisp.value = false
  }

}

const cuposDe = (fecha) => cupos[fecha] ?? 0


// SELECCIÓN DE FECHA
// Actividad: un solo día. Alojamiento: entrada y salida (la noche de salida no consume cupo).

const fechaInicio = ref('')
const fechaFin = ref('')

// ¿Se puede salir ese día? Todas las noches entre la entrada y la salida deben tener cupo
function salidaValida(fecha) {

  if (!fechaInicio.value || fecha <= fechaInicio.value) return false

  const noches = diferenciaDias(fecha, fechaInicio.value)

  if (noches > MAX_NOCHES) return false

  for (let i = 0; i < noches; i++) {
    if (cuposDe(sumarDias(fechaInicio.value, i)) < 1) return false
  }

  return true

}

function diaHabilitado(fecha) {

  if (fecha < hoyString) return false

  if (esAlojamiento.value) {
    if (fechaInicio.value && !fechaFin.value && salidaValida(fecha)) return true
    return cuposDe(fecha) >= 1
  }

  return cuposDe(fecha) >= visitantes.value

}

function seleccionarFecha(fecha) {

  error.value = ''

  if (!esAlojamiento.value) {
    fechaInicio.value = fecha
    fechaFin.value = fecha
    return
  }

  // Segundo toque: define la salida
  if (fechaInicio.value && !fechaFin.value && salidaValida(fecha)) {
    fechaFin.value = fecha
    return
  }

  // Cualquier otro toque empieza una estadía nueva
  fechaInicio.value = fecha
  fechaFin.value = ''

}

const esExtremo = (fecha) => fecha === fechaInicio.value || (esAlojamiento.value && fecha === fechaFin.value)

const enRango = (fecha) => (
  esAlojamiento.value && fechaInicio.value && fechaFin.value && fecha > fechaInicio.value && fecha < fechaFin.value
)

const noches = computed(() => {
  return esAlojamiento.value && fechaInicio.value && fechaFin.value
    ? diferenciaDias(fechaFin.value, fechaInicio.value)
    : 0
})


// VISITANTES (el backend recibe solo el total: num_personas)

const adultos = ref(1)
const ninos = ref(0)

const visitantes = computed(() => adultos.value + ninos.value)

const maxVisitantes = computed(() => destino.value?.capacidad || 8)

function aumentarAdultos() {
  if (visitantes.value < maxVisitantes.value) adultos.value++
}

function disminuirAdultos() {
  if (adultos.value > 1) adultos.value--
}

function aumentarNinos() {
  if (visitantes.value < maxVisitantes.value) ninos.value++
}

function disminuirNinos() {
  if (ninos.value > 0) ninos.value--
}

// En actividades cada persona consume un cupo: si ya no alcanzan, se pide elegir otro día
watch(visitantes, () => {
  if (!esAlojamiento.value && fechaInicio.value && cuposDe(fechaInicio.value) < visitantes.value) {
    fechaInicio.value = ''
    fechaFin.value = ''
    error.value = 'Ese día no tiene cupos para tantas personas. Elige otra fecha.'
  }
})


// TOTAL ESTIMADO (igual que el backend: el precio real lo calcula el servidor)
// Alojamiento: precio × noches. Actividad: precio × personas × días.

const listoParaCalcular = computed(() => {
  return Boolean(fechaInicio.value) && (!esAlojamiento.value || Boolean(fechaFin.value))
})

const total = computed(() => {

  if (!listoParaCalcular.value) return 0

  return esAlojamiento.value
    ? destino.value.precio * noches.value
    : destino.value.precio * visitantes.value

})


// CREAR LA RESERVA Y PASAR AL PAGO

const error = ref('')
const enviando = ref(false)

async function confirmarReserva() {

  if (enviando.value) return

  if (!fechaInicio.value) {
    error.value = esAlojamiento.value
      ? 'Selecciona tu día de entrada y de salida para continuar.'
      : 'Debes seleccionar una fecha para continuar.'
    return
  }

  if (esAlojamiento.value && !fechaFin.value) {
    error.value = 'Selecciona también tu día de salida.'
    return
  }

  error.value = ''
  enviando.value = true

  try {

    const reserva = await crearReserva({
      id_servicio: destino.value.id,
      fecha_inicio: fechaInicio.value,
      fecha_fin: esAlojamiento.value ? fechaFin.value : fechaInicio.value,
      num_personas: visitantes.value
    })

    // La reserva queda PENDIENTE_PAGO y con el cupo retenido: se paga en la siguiente pantalla
    router.replace({ name: 'Pago', params: { id: reserva.id_reserva } })

  } catch (e) {

    if (codigoError(e) === 'SIN_DISPONIBILIDAD') {

      // Otra persona reservó antes: se actualizan los cupos y se vuelve a elegir
      const fechas = detallesError(e)?.fechas_sin_disponibilidad
      error.value = fechas?.length
        ? `Ya no hay cupos para: ${fechas.map(fechaCorta).join(', ')}. Elige otras fechas.`
        : 'Ya no hay cupos para esas fechas. Elige otras.'

      fechaInicio.value = ''
      fechaFin.value = ''

      mesesCargados.clear()
      Object.keys(cupos).forEach((f) => delete cupos[f])
      await cargarMes(mesActual.value, true)

    } else {

      error.value = mensajeError(e, 'No pudimos crear la reserva.')

    }

  } finally {

    enviando.value = false

  }

}


// REGRESAR

function regresar() {

  router.push(`/destino/${route.params.id}`)

}

</script>

<style scoped>

/* CONTENEDOR */

.reserva-page {

  width: 100%;
  max-width: 430px;
  min-height: 100vh;
  margin: 0 auto;

  padding: 20px 20px 35px;

  background: #f7f6f0;
  color: #263b30;

}


/* ENCABEZADO */

.reserva-header {

  display: flex;
  align-items: flex-start;
  gap: 13px;

  margin-bottom: 23px;

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

.reserva-header small {

  font-size: 8px;
  letter-spacing: 1px;
  color: #8a8c80;

}

.reserva-header h1 {

  font-family: Georgia, serif;
  font-weight: normal;

  font-size: 25px;
  line-height: 1.15;

  margin: 7px 0;

}

.reserva-header p {

  font-size: 11px;
  color: #85877e;

}


/* TARJETA DEL DESTINO */

.destino-reserva {

  display: flex;
  align-items: center;
  gap: 12px;

  background: white;
  padding: 10px;

  border-radius: 12px;

  box-shadow: 0 3px 12px rgba(35, 55, 40, 0.06);

}

.destino-reserva img {

  width: 82px;
  height: 77px;

  object-fit: cover;
  border-radius: 8px;

}

.destino-datos {

  flex: 1;

  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 6px;

}

.destino-datos h2 {

  font-family: Georgia, serif;
  font-weight: normal;
  font-size: 15px;

  margin-bottom: 5px;

}

.destino-datos p {

  font-size: 10px;
  color: #85877e;

}

.destino-datos span {

  display: block;
  font-size: 9px;
  color: #71815f;

  margin-top: 5px;

}

.destino-datos > strong {

  font-size: 11px;
  white-space: nowrap;

}


/* CALENDARIO */

.calendario-section {

  margin-top: 27px;

}

.calendario-section h2,
.visitantes-texto h2,
.resumen h2 {

  font-family: Georgia, serif;
  font-size: 20px;
  font-weight: normal;

}

.ayuda,
.visitantes-texto p {

  font-size: 11px;
  color: #898a80;

  margin-top: 6px;

}


/* CAMBIAR MES */

.mes-header {

  display: flex;
  justify-content: space-between;
  align-items: center;

  margin: 20px 0 15px;

}

.mes-header strong {

  font-family: Georgia, serif;
  font-size: 15px;
  font-weight: normal;

  text-transform: capitalize;

}

.mes-header button {

  width: 30px;
  height: 30px;

  border: none;
  border-radius: 50%;

  background: #e9ede4;
  color: #31543d;

  font-size: 22px;

}

.mes-header button:disabled {

  opacity: 0.35;

}


/* CUADRÍCULA */

.calendario-grid {

  display: grid;

  grid-template-columns: repeat(7, 1fr);

  gap: 7px;

  text-align: center;

}

.dia-semana {

  font-size: 11px;
  color: #929389;

  padding: 7px 0;

}

.dia {

  width: 100%;
  aspect-ratio: 1;

  border: none;
  border-radius: 50%;

  background: transparent;

  color: #405344;

  font-size: 12px;

}

.dia.seleccionado {

  background: #28523d;
  color: white;

}

.dia:disabled {

  color: #c9c9c1;
  cursor: not-allowed;

}

.dia-vacio {

  aspect-ratio: 1;

}


/* FECHA ELEGIDA */

.fecha-elegida {

  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;

  margin-top: 17px;
  padding: 12px;

  border-radius: 9px;

  background: #eaf0e6;

  font-size: 10px;
  color: #52644f;

}

.fecha-elegida span {

  font-size: 13px;

}

.fecha-elegida strong {

  text-transform: capitalize;

}


/* VISITANTES */

/* SECCIÓN DE VISITANTES */

.visitantes-section {
  display: flex;
  flex-direction: column;
  gap: 22px;
  margin-top: 28px;
  padding: 22px 0;
  border-top: 1px solid #e5e3db;
  border-bottom: 1px solid #e5e3db;
}

.visitante-fila {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.visitante-texto h2 {
  font-family: Georgia, serif;
  font-size: 18px;
  font-weight: normal;
  margin: 0;
}

.visitante-texto p {
  font-size: 11px;
  color: #898a80;
  margin-top: 6px;
}

/* CONTADORES */

.contador {
  display: flex;
  align-items: center;
  gap: 14px;
}

.contador button {
  width: 34px;
  height: 34px;
  border: 1px solid #d9ded5;
  border-radius: 50%;
  background: #ffffff;
  color: #28523d;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: 0.2s;
}

.contador button:hover:not(:disabled) {
  background: #28523d;
  color: white;
}

.contador button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.contador strong {
  font-size: 15px;
  min-width: 16px;
  text-align: center;
  font-weight: 600;
}

.total-visitantes {
  font-size: 11px;
  color: #52644f;
  margin: 0;
}

/* RESUMEN */

.resumen {

  margin-top: 24px;

}

.resumen h2 {

  font-size: 19px;
  margin-bottom: 14px;

}

.resumen-linea {

  display: flex;
  justify-content: space-between;

  margin: 12px 0;

  font-size: 11px;
  color: #777a70;

}

.resumen-linea strong {

  color: #344a39;
  font-weight: 500;

}

.total-linea {

  display: flex;
  justify-content: space-between;
  align-items: center;

  margin-top: 17px;
  padding-top: 15px;

  border-top: 1px solid #e5e3db;

  font-size: 13px;

}

.total-linea strong {

  font-size: 19px;

}


/* BOTÓN CONFIRMAR */

.confirmar-button {

  width: 100%;
  height: 48px;

  margin-top: 23px;

  border: none;
  border-radius: 9px;

  background: #28523d;
  color: white;

  font-size: 12px;

}

.confirmar-button:hover {

  background: #1d402e;

}

.nota {

  text-align: center;

  font-size: 9px;
  color: #929389;

  margin-top: 10px;

}


/* CONFIRMACIÓN */

.confirmacion {

  position: fixed;
  inset: 0;

  z-index: 20;

  max-width: 430px;
  width: 100%;

  margin: 0 auto;

  padding: 35px 25px;

  background: #f7f6f0;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  text-align: center;

}

.confirmacion-icono {

  width: 65px;
  height: 65px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 50%;

  background: #e2ecdf;
  color: #28523d;

  font-size: 30px;

}

.confirmacion h1 {

  font-family: Georgia, serif;
  font-size: 27px;
  font-weight: normal;

  margin: 20px 0 10px;

}

.confirmacion > p {

  color: #85877e;
  font-size: 12px;
  line-height: 1.6;

}

.confirmacion-datos {

  width: 100%;

  background: white;

  padding: 20px;
  margin: 25px 0;

  border-radius: 12px;

  text-align: left;

}

.confirmacion-datos strong {

  font-family: Georgia, serif;
  font-size: 17px;

}

.confirmacion-datos p {

  font-size: 12px;
  margin-top: 12px;

}

.confirmacion > button {

  width: 100%;
  padding: 15px;

  background: #28523d;
  color: white;

  border: none;
  border-radius: 9px;

}


/* PANTALLA DE CONFIRMACIÓN */

.confirmacion {
  min-height: 100vh;
  padding: 55px 22px 35px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background: #f7f6f0;
}

.confirmacion-icono {
  width: 75px;
  height: 75px;
  border-radius: 50%;
  background: #e2ecdf;
  color: #28523d;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 38px;
  margin-bottom: 25px;
}

.confirmacion h1 {
  font-family: Georgia, serif;
  font-size: 27px;
  font-weight: normal;
  color: #28523d;
  margin-bottom: 12px;
}

.confirmacion-mensaje {
  font-size: 13px;
  line-height: 1.6;
  color: #77796f;
  max-width: 270px;
  margin-bottom: 30px;
}

.confirmacion-datos {
  width: 100%;
  padding: 22px 18px;
  background: #ffffff;
  border: 1px solid #e8e6de;
  border-radius: 14px;
  text-align: left;
}

.confirmacion-datos h2 {
  font-family: Georgia, serif;
  font-size: 19px;
  font-weight: normal;
  color: #28523d;
  margin-bottom: 22px;
}

.confirmacion-fila {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 17px;
  font-size: 12px;
}

.confirmacion-fila span {
  color: #898a80;
}

.confirmacion-fila strong {
  color: #303c32;
  text-align: right;
}

.confirmacion-precio {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #e5e3db;
  padding-top: 18px;
  margin-top: 5px;
  gap: 10px;
}

.confirmacion-precio span {
  font-size: 13px;
  color: #303c32;
}

.confirmacion-precio strong {
  font-size: 20px;
  color: #28523d;
}

.boton-explorar {
  width: 100%;
  margin-top: 25px;
  padding: 16px;
  border: none;
  border-radius: 9px;
  background: #28523d;
  color: white;
  font-size: 13px;
  cursor: pointer;
}

.boton-explorar:hover {
  background: #1e4230;
}

.confirmacion-pie {
  margin-top: 18px;
  font-size: 10px;
  color: #898a80;
}


/* ERRORES */

.mensaje-error {

  color: #a34638;
  font-size: 11px;

  margin-top: 12px;

}

.no-destino {

  padding: 50px 20px;
  text-align: center;

}

.no-destino button {

  margin-top: 15px;
  padding: 12px 18px;

  border: none;
  border-radius: 8px;

  background: #28523d;
  color: white;

}

/* ===== CONEXIÓN CON LA API ===== */
.unidad {
  display: block;
  font-size: 9px;
  font-weight: normal;
  color: #85877e;
  text-align: right;
}

.calendario-grid.cargando {
  opacity: 0.55;
  transition: opacity 0.2s;
}

.dia.en-rango {
  background: #dfe9d9;
  color: #28523d;
  border-radius: 8px;
}

.dia.seleccionado {
  background: #28523d;
  color: white;
  border-radius: 50%;
}

.dia:disabled {
  text-decoration: line-through;
  text-decoration-color: rgba(0, 0, 0, 0.12);
}

.leyenda {
  margin-top: 12px;
  font-size: 10.5px;
  color: #898a80;
  display: flex;
  align-items: center;
  gap: 6px;
}

.leyenda .spinner {
  width: 12px;
  height: 12px;
}

.nota-precio {
  margin-top: 10px;
  font-size: 10.5px;
  color: #898a80;
  line-height: 1.4;
}

.confirmar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.confirmar-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

</style>
