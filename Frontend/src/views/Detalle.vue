<template>
  <main class="detalle-page">

    <!-- CARGANDO -->
    <div v-if="cargando" class="bloque-cargando pagina-estado">
      <span class="spinner"></span> Cargando destino…
    </div>

    <!-- ERROR / NO ENCONTRADO -->
    <div v-else-if="!destino" class="pagina-estado estado-error">
      <h2>{{ error || 'Destino no encontrado' }}</h2>
      <button class="btn-primario" @click="regresar">Volver a explorar</button>
    </div>

    <template v-else>

      <!-- IMAGEN PRINCIPAL (se desliza con el dedo) -->
      <section
        class="detalle-hero"
        @touchstart.passive="tocarInicio"
        @touchend.passive="tocarFin"
      >

        <img
          :src="destino.fotos[fotoActual]"
          :alt="destino.nombre"
        >

        <div class="hero-buttons">

          <button @click="regresar" aria-label="Volver">
            ←
          </button>

          <div class="acciones">

            <button @click="alternarFavorito(destino.id)" aria-label="Favorito">
              {{ esFavorito(destino.id) ? '♥' : '♡' }}
            </button>

            <button @click="compartir" aria-label="Compartir">
              ↗
            </button>

          </div>

        </div>

        <div v-if="destino.fotos.length > 1" class="contador">
          {{ fotoActual + 1 }} / {{ destino.fotos.length }}
        </div>

      </section>


      <!-- INFORMACIÓN DEL DESTINO -->
      <section class="detalle-contenido">

        <p v-if="avisoDenuncia" class="aviso-ok">{{ avisoDenuncia }}</p>

        <div class="encabezado-destino">

          <div>
            <h1>{{ destino.nombre }}</h1>

            <p class="ubicacion">
              ♧ {{ destino.ubicacion }}
            </p>
          </div>

          <div class="calificacion">
            <template v-if="destino.calificacion">
              ★ {{ Number(destino.calificacion).toFixed(1) }}
              <small>({{ destino.resenas }} reseñas)</small>
            </template>
            <small v-else>Aún sin reseñas</small>
          </div>

        </div>


        <!-- CARACTERÍSTICAS -->
        <section class="caracteristicas">

          <div class="caracteristica">
            <span>⌂</span>
            <strong>{{ tipoEtiqueta }}</strong>
            <small>Tipo</small>
          </div>

          <div v-if="destino.capacidad" class="caracteristica">
            <span>♙</span>
            <strong>{{ destino.capacidad }} personas</strong>
            <small>Capacidad</small>
          </div>

          <div class="caracteristica">
            <span>♧</span>
            <strong>{{ destino.categoria }}</strong>
            <small>Categoría</small>
          </div>

        </section>


        <!-- DESCRIPCIÓN -->
        <section class="descripcion">

          <h2>Conoce este lugar</h2>

          <p>
            {{ destino.descripcion }}
          </p>

        </section>


        <!-- ANFITRIÓN Y CONTACTO -->
        <section class="datos-extra">

          <p v-if="destino.anfitrion">
            <span>Anfitrión</span>
            <strong>{{ destino.anfitrion }}</strong>
          </p>

          <p v-if="destino.direccion">
            <span>Dirección</span>
            <strong>{{ destino.direccion }}</strong>
          </p>

          <p v-if="destino.contacto">
            <span>Contacto</span>
            <strong>{{ destino.contacto }}</strong>
          </p>

        </section>


        <button class="denunciar" @click="abrirDenuncia({ id_servicio: destino.id }, 'esta publicación')">
          ⚑ Denunciar esta publicación
        </button>

        <!-- RESEÑAS -->
        <section class="resenas-detalle">

          <h2>Lo que dicen los viajeros</h2>

          <p v-if="cargandoResenas" class="resenas-estado">
            <span class="spinner"></span> Cargando reseñas…
          </p>

          <p v-else-if="resenas.length === 0" class="resenas-estado">
            Todavía nadie ha dejado una reseña. ¡Sé la primera persona!
          </p>

          <article v-for="r in resenas" :key="r.id_calificacion" class="resena-item">

            <div class="resena-cabecera">
              <strong>{{ r.autor }}</strong>
              <span>{{ '★'.repeat(r.puntuacion) }}<i>{{ '★'.repeat(5 - r.puntuacion) }}</i></span>
            </div>

            <p v-if="r.comentario">{{ r.comentario }}</p>

            <small>
              {{ fechaCorta(r.fecha) }}
              <button class="denunciar-resena" @click="abrirDenuncia({ id_calificacion: r.id_calificacion }, 'esta reseña')">
                Denunciar
              </button>
            </small>

          </article>

          <button
            v-if="paginaResenas < totalPaginasResenas"
            class="btn-secundario"
            :disabled="cargandoResenas"
            @click="cargarResenas(paginaResenas + 1)"
          >
            Ver más reseñas
          </button>

        </section>


        <!-- RESERVA -->
        <section class="reserva-footer">

          <template v-if="reservable">

            <div class="precio">

              <small>Desde</small>

              <div>
                <strong>
                  {{ dinero(destino.precio) }}
                </strong>

                <span>/ {{ destino.unidadPrecio }}</span>
              </div>

            </div>

            <button
              class="reservar-button"
              @click="reservar"
            >
              Reservar una visita →
            </button>

          </template>

          <p v-else class="sin-reserva">
            Este negocio local no recibe reservas en la app.
            Contáctalo directamente<template v-if="destino.contacto">: <strong>{{ destino.contacto }}</strong></template>.
          </p>

        </section>

      </section>

    </template>

    <MotivoModal
      :abierto="Boolean(objetivoDenuncia)"
      titulo="Denunciar contenido"
      :mensaje="`Cuéntanos por qué quieres denunciar ${textoDenuncia}. Un administrador lo revisará.`"
      texto-confirmar="Enviar denuncia"
      peligro
      :cargando="enviandoDenuncia"
      :error="errorDenuncia"
      @confirmar="enviarDenuncia"
      @cancelar="objetivoDenuncia = null"
    />

  </main>
</template>


<script setup>

import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { obtenerServicio, listarResenasServicio, TIPOS } from '../services/destinos'
import { esFavorito, alternarFavorito } from '../services/favoritos'
import { mensajeError, codigoError } from '../services/api'
import { dinero, fechaCorta } from '../utils/formato'
import { denunciar } from '../services/denuncias'
import MotivoModal from '../components/MotivoModal.vue'

const router = useRouter()
const route = useRoute()


// DESTINO

const destino = ref(null)
const cargando = ref(true)
const error = ref('')

const tipoEtiqueta = computed(() => TIPOS[destino.value?.tipo]?.etiqueta ?? '')

// Los negocios locales se muestran, pero no se reservan (el backend responde 400)
const reservable = computed(() => destino.value && destino.value.tipo !== 'NEGOCIO_LOCAL')

onMounted(async () => {
  try {
    destino.value = await obtenerServicio(route.params.id)
    cargarResenas(1)
  } catch (e) {
    error.value = codigoError(e) === 'NO_ENCONTRADO' ? '' : mensajeError(e, 'No pudimos cargar el destino.')
  } finally {
    cargando.value = false
  }
})


// RESEÑAS

const resenas = ref([])
const paginaResenas = ref(1)
const totalPaginasResenas = ref(1)
const cargandoResenas = ref(false)

async function cargarResenas(pagina) {
  cargandoResenas.value = true

  try {
    const r = await listarResenasServicio(destino.value.id, pagina, 5)

    resenas.value = pagina === 1 ? r.data : [...resenas.value, ...r.data]
    paginaResenas.value = pagina
    totalPaginasResenas.value = r.meta.total_pages
  } catch {
    // Las reseñas son opcionales: si fallan, el resto de la pantalla sigue funcionando
  } finally {
    cargandoResenas.value = false
  }
}


// DENUNCIAS (RF-34)

const objetivoDenuncia = ref(null)
const textoDenuncia = ref('')
const enviandoDenuncia = ref(false)
const errorDenuncia = ref('')
const avisoDenuncia = ref('')

function abrirDenuncia(objetivo, texto) {
  objetivoDenuncia.value = objetivo
  textoDenuncia.value = texto
  errorDenuncia.value = ''
  avisoDenuncia.value = ''
}

async function enviarDenuncia(motivo) {
  enviandoDenuncia.value = true
  errorDenuncia.value = ''

  try {
    await denunciar({ ...objetivoDenuncia.value, motivo })
    objetivoDenuncia.value = null
    avisoDenuncia.value = 'Gracias. Recibimos tu denuncia y la revisaremos.'
  } catch (e) {
    // Por ejemplo: ya tienes una denuncia pendiente sobre este contenido, o es tu propio contenido
    errorDenuncia.value = mensajeError(e, 'No pudimos enviar la denuncia.')
  } finally {
    enviandoDenuncia.value = false
  }
}


// GALERÍA: toque lateral para cambiar de foto

const fotoActual = ref(0)
let inicioX = null

function cambiarFoto(paso) {
  const total = destino.value.fotos.length
  fotoActual.value = (fotoActual.value + paso + total) % total
}

function tocarInicio(evento) {
  inicioX = evento.touches[0].clientX
}

function tocarFin(evento) {
  if (inicioX === null || destino.value.fotos.length < 2) return

  const diferencia = evento.changedTouches[0].clientX - inicioX
  inicioX = null

  if (Math.abs(diferencia) > 50) cambiarFoto(diferencia < 0 ? 1 : -1)
}


// REGRESAR A EXPLORAR

function regresar() {
  router.push('/explorar')
}


// COMPARTIR

async function compartir() {

  const enlace = window.location.href

  try {

    if (navigator.share) {

      await navigator.share({
        title: destino.value.nombre,
        text: 'Conoce este destino en Raíz',
        url: enlace
      })

    } else {

      await navigator.clipboard.writeText(enlace)

      alert('Enlace copiado correctamente.')

    }

  } catch (e) {

    if (e.name !== 'AbortError') {
      alert('No fue posible compartir el destino.')
    }

  }

}


// RESERVAR

function reservar() {

  router.push(`/reserva/${destino.value.id}`)

}

</script>

<style scoped>

/* CONTENEDOR */

.detalle-page {
  width: 100%;
  max-width: 430px;
  min-height: 100vh;
  margin: 0 auto;
  background: #f7f6f0;
  color: #263b30;
  padding-bottom: 30px;
}


/* IMAGEN PRINCIPAL */

.detalle-hero {
  height: 290px;
  width: 100%;
  position: relative;
  overflow: hidden;
}

.detalle-hero img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.hero-buttons {
  position: absolute;
  top: 18px;
  left: 18px;
  right: 18px;

  display: flex;
  justify-content: space-between;
}

.hero-buttons button {
  width: 37px;
  height: 37px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.93);
  color: #294936;
  font-size: 19px;
}

.acciones {
  display: flex;
  gap: 10px;
}

.contador {
  position: absolute;
  bottom: 14px;
  right: 15px;
  background: rgba(0, 0, 0, 0.45);
  color: white;
  padding: 6px 11px;
  border-radius: 20px;
  font-size: 10px;
}


/* CONTENIDO */

.detalle-contenido {
  padding: 22px 21px;
}

.encabezado-destino {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.encabezado-destino h1 {
  font-family: Georgia, serif;
  font-size: 25px;
  font-weight: normal;
  margin-bottom: 8px;
}

.ubicacion {
  color: #85867c;
  font-size: 11px;
}

.calificacion {
  color: #526d43;
  font-size: 12px;
  white-space: nowrap;
  text-align: right;
  padding-top: 5px;
}

.calificacion small {
  display: block;
  color: #929287;
  font-size: 9px;
  margin-top: 4px;
}


/* CARACTERÍSTICAS */

.caracteristicas {
  display: flex;
  justify-content: space-around;
  align-items: center;

  background: #eaf0e6;
  border-radius: 12px;

  padding: 17px 5px;
  margin: 23px 0;
}

.caracteristica {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.caracteristica span {
  font-size: 20px;
  color: #42634b;
}

.caracteristica strong {
  font-size: 12px;
  font-weight: 600;
}

.caracteristica small {
  font-size: 10px;
  color: #82877c;
}


/* DESCRIPCIÓN */

.descripcion h2,
.incluye h2 {
  font-family: Georgia, serif;
  font-weight: normal;
  font-size: 21px;
  margin-bottom: 12px;
}

.descripcion p {
  color: #73766d;
  font-size: 12px;
  line-height: 1.7;
}


/* INCLUYE */

.incluye {
  margin-top: 25px;
}

.incluye-item {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px 0;
  font-size: 12px;
  color: #646b60;
}

.incluye-item span {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 21px;
  height: 21px;
  border-radius: 50%;
  background: #e3ebdf;
  color: #315b43;
  font-size: 12px;
}


/* RESERVA */

.reserva-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  margin-top: 25px;
  padding-top: 18px;

  border-top: 1px solid #e3e1d8;
}

.precio small {
  display: block;
  font-size: 10px;
  color: #898b81;
  margin-bottom: 5px;
}

.precio strong {
  font-size: 17px;
}

.precio span {
  font-size: 10px;
  color: #898b81;
}

.reservar-button {
  flex: 1;
  max-width: 190px;
  height: 45px;

  background: #28523d;
  color: white;

  border: none;
  border-radius: 9px;

  font-size: 11px;
}

.reservar-button:hover {
  background: #1d402e;
}

/* ===== CONEXIÓN CON LA API ===== */
.pagina-estado {
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 30px;
  text-align: center;
}

.estado-error h2 {
  font-family: Georgia, serif;
  font-weight: normal;
  font-size: 20px;
  color: #263b30;
}

.estado-error .btn-primario {
  max-width: 240px;
}

.datos-extra {
  margin: 22px 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.datos-extra p {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  font-size: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #ebe9df;
}

.datos-extra span {
  color: #8a8c80;
}

.datos-extra strong {
  font-weight: normal;
  text-align: right;
  color: #263b30;
}

.resenas-detalle {
  margin-bottom: 22px;
}

.resenas-detalle h2 {
  font-family: Georgia, serif;
  font-weight: normal;
  font-size: 19px;
  margin-bottom: 12px;
}

.resenas-estado {
  font-size: 12px;
  color: #77776f;
  padding: 10px 0;
}

.resena-item {
  background: white;
  border-radius: 12px;
  padding: 13px 14px;
  margin-bottom: 10px;
  box-shadow: 0 2px 8px rgba(35, 55, 40, 0.05);
}

.resena-cabecera {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  margin-bottom: 6px;
}

.resena-cabecera span {
  color: #d99a1f;
  font-size: 12px;
  letter-spacing: 1px;
}

.resena-cabecera i {
  font-style: normal;
  color: #dcdad0;
}

.resena-item p {
  font-size: 12px;
  line-height: 1.5;
  color: #4d5a50;
  margin-bottom: 6px;
}

.resena-item small {
  font-size: 10px;
  color: #9a9a90;
}

.sin-reserva {
  font-size: 12px;
  line-height: 1.5;
  color: #55604f;
  background: #eef2ea;
  border-radius: 10px;
  padding: 13px 14px;
  width: 100%;
}

.denunciar {
  background: none;
  border: none;
  padding: 0;
  margin: 0 0 22px;
  font-size: 11px;
  color: #a33a3a;
  text-decoration: underline;
}

.denunciar-resena {
  background: none;
  border: none;
  padding: 0;
  margin-left: 10px;
  font-size: 10px;
  color: #a33a3a;
  text-decoration: underline;
}

.detalle-contenido .aviso-ok {
  margin: 0 0 14px;
}

</style>
