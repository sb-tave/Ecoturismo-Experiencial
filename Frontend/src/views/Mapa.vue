<template>
  <main class="mapa-page">

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

    <!-- TÍTULO -->
    <section class="contenido">

      <div class="titulo">
        <h2>Explora el mapa</h2>
        <p>
          Descubre destinos naturales y encuentra tu próxima experiencia.
        </p>
      </div>

      <!-- INFORMACIÓN Y UBICACIÓN -->
      <div class="mapa-info">
        <span>⌖</span>
        <p v-if="cargando">Cargando destinos…</p>
        <p v-else>{{ cantidad }} {{ cantidad === 1 ? 'destino disponible' : 'destinos disponibles' }}</p>
      </div>

      <button class="mapa-cerca" :disabled="buscandoUbicacion" @click="buscarCerca">
        {{ cercaActiva ? 'Ver todos los destinos' : (buscandoUbicacion ? 'Buscando tu ubicación…' : '⌖ Cerca de mí') }}
      </button>

      <p v-if="error" class="aviso-error">{{ error }}</p>

      <!-- MAPA INTERACTIVO -->
      <div ref="mapaContenedor" class="mapa-contenedor"></div>

      <p class="ayuda-mapa">
        Selecciona un marcador para conocer más sobre el destino.
      </p>

      <!-- INFORMACIÓN DEL DESTINO -->
      <article v-if="destinoSeleccionado" class="destino-card">

        <img
          :src="destinoSeleccionado.imagen"
          :alt="destinoSeleccionado.nombre"
        >

        <div class="destino-contenido">

          <div class="destino-encabezado">
            <h3>{{ destinoSeleccionado.nombre }}</h3>
            <span>{{ destinoSeleccionado.calificacion ? '★ ' + Number(destinoSeleccionado.calificacion).toFixed(1) : 'Nuevo' }}</span>
          </div>

          <p class="ubicacion">
            ⌖ {{ destinoSeleccionado.ubicacion }}
            <template v-if="destinoSeleccionado.distanciaKm != null"> · a {{ destinoSeleccionado.distanciaKm }} km</template>
          </p>

          <p class="descripcion">
            {{ destinoSeleccionado.descripcion }}
          </p>

          <div class="datos-destino">
            <span>{{ destinoSeleccionado.categoria }}</span>
            <span>{{ TIPOS[destinoSeleccionado.tipo]?.etiqueta }}</span>
          </div>

          <div v-if="destinoSeleccionado.precio != null" class="precio">
            <span>Desde</span>
            <strong>
              {{ dinero(destinoSeleccionado.precio) }}
            </strong>
          </div>

          <button
            class="boton-explorar"
            @click="router.push(`/destino/${destinoSeleccionado.id}`)"
          >
            Ver experiencia →
          </button>

        </div>

      </article>

      <div v-else class="sin-seleccion">
        <span>🌿</span>
        <p>Selecciona un destino en el mapa para ver su información.</p>
      </div>

    </section>

    <!-- NAVEGACIÓN INFERIOR -->
    <nav class="bottom-nav">

      <button class="nav-item" @click="router.push('/explorar')">
        <span>⌂</span>
        <small>Explorar</small>
      </button>

      <button class="nav-item activo">
        <span>⌖</span>
        <small>Mapa</small>
      </button>

      <button class="nav-item" @click="router.push('/mis-reservas')">
        <span>▣</span>
        <small>Mis reservas</small>
      </button>

      <button class="nav-item" @click="router.push('/perfil')">
        <span>♙</span>
        <small>Perfil</small>
      </button>

    </nav>

  </main>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import L from 'leaflet'

import 'leaflet/dist/leaflet.css'

import { listarServicios, TIPOS } from '../services/destinos'
import { mensajeError } from '../services/api'
import { dinero } from '../utils/formato'

const router = useRouter()

const mapaContenedor = ref(null)
const destinoSeleccionado = ref(null)

const cargando = ref(true)
const error = ref('')
const cantidad = ref(0)

const cercaActiva = ref(false)
const buscandoUbicacion = ref(false)

let mapa = null
let capaMarcadores = null
let marcadorUsuario = null

const CENTRO_POR_DEFECTO = [4.6370, -75.5700]

// CREAR MAPA

onMounted(async () => {

  await nextTick()

  mapa = L.map(mapaContenedor.value).setView(CENTRO_POR_DEFECTO, 11)

  // CAPA DEL MAPA

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(mapa)

  capaMarcadores = L.layerGroup().addTo(mapa)

  await cargarDestinos()

  mapa.invalidateSize()

})


// MARCADORES DE LOS DESTINOS (vienen de la API)

async function cargarDestinos(ubicacion = null) {

  cargando.value = true
  error.value = ''
  destinoSeleccionado.value = null

  try {

    const { destinos } = await listarServicios({
      limit: 50,
      ...(ubicacion
        ? { lat: ubicacion.lat, lng: ubicacion.lng, radio_km: 50, orden: 'distancia' }
        : {})
    })

    pintarMarcadores(destinos)

  } catch (e) {

    error.value = mensajeError(e, 'No pudimos cargar los destinos del mapa.')

  } finally {

    cargando.value = false

  }

}

function pintarMarcadores(destinos) {

  capaMarcadores.clearLayers()

  const coordenadas = []

  destinos.forEach(destino => {

    if (destino.latitud == null || destino.longitud == null) return

    const posicion = [
      destino.latitud,
      destino.longitud
    ]

    coordenadas.push(posicion)

    const icono = L.divIcon({
      className: 'marcador-raiz',
      html: '<div class="marcador-punto">🌿</div>',
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    })

    const marcador = L.marker(posicion, {
      icon: icono
    }).addTo(capaMarcadores)

    marcador.on('click', () => {
      destinoSeleccionado.value = destino
    })

  })

  cantidad.value = coordenadas.length

  // AJUSTAR VISTA A LOS DESTINOS

  if (coordenadas.length > 1) {

    mapa.fitBounds(coordenadas, {
      padding: [35, 35]
    })

  } else if (coordenadas.length === 1) {

    mapa.setView(coordenadas[0], 13)

  }

}


// CERCA DE MÍ: la ubicación solo se usa si la persona lo pide (RNF-08)

function buscarCerca() {

  if (cercaActiva.value) {

    cercaActiva.value = false

    if (marcadorUsuario) {
      mapa.removeLayer(marcadorUsuario)
      marcadorUsuario = null
    }

    cargarDestinos()
    return

  }

  if (!navigator.geolocation) {
    error.value = 'Tu navegador no permite obtener la ubicación.'
    return
  }

  buscandoUbicacion.value = true
  error.value = ''

  navigator.geolocation.getCurrentPosition(
    async (posicion) => {

      const ubicacion = { lat: posicion.coords.latitude, lng: posicion.coords.longitude }

      marcadorUsuario = L.circleMarker([ubicacion.lat, ubicacion.lng], {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: '#2f6fd6',
        fillOpacity: 1
      }).addTo(mapa)

      cercaActiva.value = true
      buscandoUbicacion.value = false

      await cargarDestinos(ubicacion)

      if (cantidad.value === 0) {
        error.value = 'No hay destinos a menos de 50 km de ti.'
        mapa.setView([ubicacion.lat, ubicacion.lng], 11)
      }

    },
    () => {
      buscandoUbicacion.value = false
      error.value = 'No pudimos obtener tu ubicación. Revisa los permisos del navegador.'
    },
    { enableHighAccuracy: false, timeout: 10000 }
  )

}

// CERRAR MAPA

onBeforeUnmount(() => {

  if (mapa) {
    mapa.remove()
    mapa = null
  }

})

</script>

<style scoped>

.mapa-page {
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
  cursor: pointer;
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

/* INFORMACIÓN DEL MAPA */

.mapa-info {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 22px;
  padding: 13px;
  background: white;
  border: 1px solid #eeede7;
  border-radius: 10px;
}

.mapa-info span {
  font-size: 22px;
  color: #28523d;
}

.mapa-info p {
  font-size: 11px;
  color: #555f54;
}

/* MAPA */

.mapa-contenedor {
  width: 100%;
  height: 350px;
  margin-top: 15px;
  border-radius: 13px;
  overflow: hidden;
  border: 1px solid #e5e3da;
  z-index: 1;
}

.ayuda-mapa {
  font-size: 10px;
  color: #89897f;
  margin-top: 10px;
}

/* TARJETA DEL DESTINO */

.destino-card {
  background: white;
  border: 1px solid #eeede7;
  border-radius: 13px;
  overflow: hidden;
  margin-top: 20px;
}

.destino-card img {
  width: 100%;
  height: 155px;
  object-fit: cover;
}

.destino-contenido {
  padding: 15px;
}

.destino-encabezado {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.destino-encabezado h3 {
  font-family: Georgia, serif;
  font-size: 18px;
  font-weight: normal;
}

.destino-encabezado span {
  color: #a28b45;
  font-size: 12px;
}

.ubicacion {
  color: #89897f;
  font-size: 11px;
  margin-top: 7px;
}

.descripcion {
  font-size: 11px;
  line-height: 1.6;
  margin-top: 13px;
  color: #555f54;
}

.datos-destino {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 15px;
}

.datos-destino span {
  background: #edf1e9;
  color: #28523d;
  padding: 7px 10px;
  border-radius: 15px;
  font-size: 10px;
}

.precio {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 17px;
  padding-top: 13px;
  border-top: 1px solid #eeede7;
}

.precio span {
  font-size: 11px;
  color: #89897f;
}

.precio strong {
  color: #28523d;
  font-size: 17px;
}

.boton-explorar {
  width: 100%;
  padding: 12px;
  margin-top: 15px;
  border: none;
  border-radius: 8px;
  background: #28523d;
  color: white;
  font-size: 11px;
  cursor: pointer;
}

/* SIN SELECCIÓN */

.sin-seleccion {
  background: white;
  border: 1px solid #eeede7;
  border-radius: 12px;
  padding: 23px;
  text-align: center;
  margin-top: 18px;
}

.sin-seleccion span {
  font-size: 27px;
}

.sin-seleccion p {
  font-size: 11px;
  color: #89897f;
  margin-top: 8px;
  line-height: 1.5;
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
  z-index: 100;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: #999b91;
  cursor: pointer;
  flex: 1;
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
.mapa-cerca {
  width: 100%;
  height: 40px;
  margin: 0 0 12px;
  border: 1px solid #cfd8c9;
  border-radius: 10px;
  background: white;
  color: #28523d;
  font-size: 12px;
}

.mapa-cerca:disabled {
  opacity: 0.6;
}

</style>

<style>
/* MARCADOR PERSONALIZADO DE RAÍZ */

.marcador-raiz {
  background: transparent;
  border: none;
}

.marcador-punto {
  width: 36px;
  height: 36px;
  background: #28523d;
  border: 3px solid white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  box-shadow: 0 2px 8px #0003;
}

</style>
