<template>
  <main class="explorar-page">

    <!-- ENCABEZADO -->
    <header class="topbar">

      <div class="brand">
        <h1>raíz</h1>
        <span>ECOTURISMO Y CONEXIÓN</span>
      </div>

      <div class="topbar-acciones">

        <button class="campana" @click="router.push('/notificaciones')" aria-label="Notificaciones">
          ♫
          <span v-if="noLeidas > 0" class="badge">{{ noLeidas > 9 ? '9+' : noLeidas }}</span>
        </button>

        <button class="profile" @click="irPerfil" aria-label="Mi perfil">
          {{ inicial }}
        </button>

      </div>

    </header>


    <!-- CONTENIDO PRINCIPAL -->
    <section class="contenido">

      <div class="bienvenida">
        <h2>Tu próxima pausa<br>empieza aquí.</h2>
      </div>


      <!-- BUSCADOR -->
      <div class="buscador">

        <span class="search-icon">⌕</span>

        <input
          type="text"
          v-model="busqueda"
          placeholder="¿A dónde quieres ir?"
        >

        <button class="filter-button" @click="mostrarFiltros = true" aria-label="Filtros">
          ☷
          <span v-if="filtrosActivos > 0" class="badge badge-filtro">{{ filtrosActivos }}</span>
        </button>

      </div>


      <!-- CATEGORÍAS (vienen de la API) -->
      <div class="categorias">

        <button
          :class="{ activa: categoriaSeleccionada === null }"
          @click="categoriaSeleccionada = null"
        >
          Todos
        </button>

        <button
          v-for="categoria in categorias"
          :key="categoria.id_categoria"
          :class="{ activa: categoriaSeleccionada === categoria.id_categoria }"
          @click="categoriaSeleccionada = categoria.id_categoria"
        >
          {{ categoria.nombre }}
        </button>

      </div>


      <!-- SECCIÓN DE DESTINOS -->
      <section class="destacados">

        <div class="seccion-titulo">

          <h3>Déjate sorprender</h3>

          <button @click="irMapa">
            Ver mapa →
          </button>

        </div>


        <!-- CARGANDO -->
        <div v-if="cargando" class="bloque-cargando">
          <span class="spinner"></span> Buscando experiencias…
        </div>

        <!-- ERROR -->
        <div v-else-if="error" class="aviso-error">
          {{ error }}
          <button @click="cargar(true)">Reintentar</button>
        </div>

        <!-- TARJETAS -->
        <div v-else class="destinos">

          <article
            v-for="destino in destinos"
            :key="destino.id"
            class="destination-card"
            @click="abrirDestino(destino)"
          >

            <div class="destination-image">

              <img
                :src="destino.imagen"
                :alt="destino.nombre"
                loading="lazy"
              >

              <span v-if="destino.calificacion >= 4.5" class="etiqueta">
                ✦ Recomendado
              </span>

              <button
                class="favorite"
                @click.stop="alternarFavorito(destino.id)"
                :aria-label="esFavorito(destino.id) ? 'Quitar de favoritos' : 'Guardar en favoritos'"
              >
                {{ esFavorito(destino.id) ? '♥' : '♡' }}
              </button>

            </div>


            <div class="destination-info">

              <div class="destination-heading">

                <div>
                  <h4>{{ destino.nombre }}</h4>

                  <p class="ubicacion">
                    ♧ {{ destino.ubicacion }}
                    <template v-if="destino.distanciaKm != null"> · {{ destino.distanciaKm }} km</template>
                  </p>
                </div>

                <div class="rating">
                  {{ destino.calificacion ? '★ ' + Number(destino.calificacion).toFixed(1) : 'Nuevo' }}
                </div>

              </div>


              <div class="destination-footer">

                <div class="precio">
                  <template v-if="destino.precio != null">
                    <strong>{{ dinero(destino.precio) }}</strong>
                    <span>/ {{ destino.unidadPrecio }}</span>
                  </template>
                  <strong v-else class="consultar">Consultar</strong>
                </div>

                <span class="categoria-label">
                  {{ destino.categoria }}
                </span>

              </div>

            </div>

          </article>


          <!-- MENSAJE CUANDO NO HAY RESULTADOS -->
          <div v-if="destinos.length === 0" class="sin-resultados">

            <span>🌿</span>

            <h3>No encontramos destinos</h3>

            <p>
              Intenta buscar otro lugar o seleccionar otra categoría.
            </p>

            <button @click="limpiarBusqueda">
              Ver todos los destinos
            </button>

          </div>

          <!-- VER MÁS -->
          <button
            v-if="pagina < totalPaginas"
            class="ver-mas"
            :disabled="cargandoMas"
            @click="cargarMas"
          >
            <span v-if="cargandoMas" class="spinner"></span>
            {{ cargandoMas ? 'Cargando…' : 'Ver más experiencias' }}
          </button>

        </div>

      </section>

    </section>


    <!-- PANEL DE FILTROS -->
    <div v-if="mostrarFiltros" class="filtros-fondo" @click.self="mostrarFiltros = false">

      <div class="filtros-panel">

        <h3>Filtrar experiencias</h3>

        <p class="filtro-titulo">Tipo</p>
        <div class="chips">
          <button
            v-for="t in tipos"
            :key="t.valor"
            :class="{ activa: borrador.tipo === t.valor }"
            @click="borrador.tipo = t.valor"
          >
            {{ t.etiqueta }}
          </button>
        </div>

        <p class="filtro-titulo">Ordenar por</p>
        <div class="chips">
          <button
            v-for="o in ordenes"
            :key="o.valor"
            :class="{ activa: borrador.orden === o.valor }"
            @click="borrador.orden = o.valor"
          >
            {{ o.etiqueta }}
          </button>
        </div>

        <p class="filtro-titulo">Precio (COP)</p>
        <div class="rango">
          <input type="number" min="0" inputmode="numeric" v-model.number="borrador.precioMin" placeholder="Mínimo">
          <span>—</span>
          <input type="number" min="0" inputmode="numeric" v-model.number="borrador.precioMax" placeholder="Máximo">
        </div>

        <p class="filtro-titulo">Calificación mínima</p>
        <div class="chips">
          <button
            v-for="c in calificaciones"
            :key="c.valor"
            :class="{ activa: borrador.calificacionMin === c.valor }"
            @click="borrador.calificacionMin = c.valor"
          >
            {{ c.etiqueta }}
          </button>
        </div>

        <div class="filtros-acciones">
          <button class="btn-secundario" @click="limpiarFiltros">Limpiar</button>
          <button class="btn-primario" @click="aplicarFiltros">Aplicar</button>
        </div>

      </div>

    </div>


    <!-- NAVEGACIÓN INFERIOR -->
    <nav class="bottom-nav">

      <button class="nav-item activo" @click="irExplorar">
        <span>⌂</span>
        <small>Explorar</small>
      </button>

      <button class="nav-item" @click="irMapa">
        <span>⌖</span>
        <small>Mapa</small>
      </button>

      <button class="nav-item" @click="irReservas">
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

import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { listarServicios, listarCategorias } from '../services/destinos'
import { contarNoLeidas } from '../services/notificaciones'
import { esFavorito, alternarFavorito } from '../services/favoritos'
import { inicialUsuario } from '../services/auth'
import { mensajeError } from '../services/api'
import { dinero } from '../utils/formato'

const router = useRouter()

const POR_PAGINA = 10

const inicial = computed(() => inicialUsuario())


// ESTADO

const busqueda = ref('')
const categorias = ref([])
const categoriaSeleccionada = ref(null)

const destinos = ref([])
const pagina = ref(1)
const totalPaginas = ref(1)

const cargando = ref(true)
const cargandoMas = ref(false)
const error = ref('')

const noLeidas = ref(0)


// FILTROS

const tipos = [
  { valor: '', etiqueta: 'Todos' },
  { valor: 'ALOJAMIENTO', etiqueta: 'Alojamientos' },
  { valor: 'ACTIVIDAD', etiqueta: 'Actividades' },
  { valor: 'NEGOCIO_LOCAL', etiqueta: 'Negocios locales' }
]

const ordenes = [
  { valor: 'recientes', etiqueta: 'Más recientes' },
  { valor: 'calificacion', etiqueta: 'Mejor calificados' },
  { valor: 'precio_asc', etiqueta: 'Precio: menor a mayor' },
  { valor: 'precio_desc', etiqueta: 'Precio: mayor a menor' }
]

const calificaciones = [
  { valor: '', etiqueta: 'Todas' },
  { valor: 3, etiqueta: '3+ ★' },
  { valor: 4, etiqueta: '4+ ★' }
]

const vacios = () => ({ tipo: '', orden: 'recientes', precioMin: '', precioMax: '', calificacionMin: '' })

const filtros = reactive(vacios())
const borrador = reactive(vacios())
const mostrarFiltros = ref(false)

const filtrosActivos = computed(() => {
  let n = 0
  if (filtros.tipo) n++
  if (filtros.orden !== 'recientes') n++
  if (filtros.precioMin !== '' && filtros.precioMin != null) n++
  if (filtros.precioMax !== '' && filtros.precioMax != null) n++
  if (filtros.calificacionMin) n++
  return n
})

watch(mostrarFiltros, (abierto) => {
  if (abierto) Object.assign(borrador, filtros)
})

function aplicarFiltros() {
  Object.assign(filtros, borrador)
  mostrarFiltros.value = false
  cargar(true)
}

function limpiarFiltros() {
  Object.assign(borrador, vacios())
}


// CARGA DE DESTINOS (con protección contra respuestas que llegan desordenadas)

let ultimaSolicitud = 0

function parametros(page) {
  const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? undefined : Number(v))
  return {
    page,
    limit: POR_PAGINA,
    q: busqueda.value.trim() || undefined,
    id_categoria: categoriaSeleccionada.value ?? undefined,
    tipo: filtros.tipo || undefined,
    orden: filtros.orden,
    precio_min: num(filtros.precioMin),
    precio_max: num(filtros.precioMax),
    calificacion_min: num(filtros.calificacionMin)
  }
}

async function cargar(reiniciar = true) {
  const solicitud = ++ultimaSolicitud

  if (reiniciar) {
    cargando.value = true
    pagina.value = 1
  }

  error.value = ''

  try {
    const { destinos: lista, meta } = await listarServicios(parametros(1))
    if (solicitud !== ultimaSolicitud) return

    destinos.value = lista
    totalPaginas.value = meta.total_pages
  } catch (e) {
    if (solicitud !== ultimaSolicitud) return
    error.value = mensajeError(e, 'No pudimos cargar los destinos.')
  } finally {
    if (solicitud === ultimaSolicitud) cargando.value = false
  }
}

async function cargarMas() {
  if (cargandoMas.value) return

  cargandoMas.value = true

  try {
    const siguiente = pagina.value + 1
    const { destinos: lista, meta } = await listarServicios(parametros(siguiente))

    destinos.value = [...destinos.value, ...lista]
    pagina.value = siguiente
    totalPaginas.value = meta.total_pages
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos cargar más destinos.')
  } finally {
    cargandoMas.value = false
  }
}

// Busca 400 ms después de que la persona deja de escribir
let temporizador = null

watch(busqueda, () => {
  clearTimeout(temporizador)
  temporizador = setTimeout(() => cargar(true), 400)
})

watch(categoriaSeleccionada, () => cargar(true))

onMounted(async () => {
  cargar(true)

  try {
    categorias.value = await listarCategorias()
  } catch {
    // Sin categorías la pantalla sigue funcionando con "Todos"
  }

  try {
    noLeidas.value = await contarNoLeidas()
  } catch {
    // El contador es opcional
  }
})


// ACCIONES DE LA PANTALLA

function abrirDestino(destino) {
  router.push(`/destino/${destino.id}`)
}

function limpiarBusqueda() {
  busqueda.value = ''
  categoriaSeleccionada.value = null
  Object.assign(filtros, vacios())
  cargar(true)
}


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

</script>

<style scoped>

/* PÁGINA PRINCIPAL */

.explorar-page {
  width: 100%;
  max-width: 430px;
  min-height: 100vh;
  margin: 0 auto;
  padding-bottom: 85px;
  background: #f7f6f0;
  color: #263b30;
  position: relative;
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

.profile {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: #ebe9df;
  color: #365541;
  font-family: Georgia, serif;
  font-size: 15px;
}


/* BIENVENIDA */

.contenido {
  padding: 15px 22px;
}

.bienvenida h2 {
  font-family: Georgia, serif;
  font-size: 29px;
  font-weight: normal;
  line-height: 1.12;
  margin-bottom: 22px;
}


/* BUSCADOR */

.buscador {
  height: 45px;
  display: flex;
  align-items: center;
  background: white;
  border: 1px solid #e4e2d9;
  border-radius: 10px;
  padding: 0 12px;
  gap: 10px;
}

.search-icon {
  font-size: 25px;
  color: #777;
}

.buscador input {
  flex: 1;
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: #344b3c;
  font-size: 12px;
}

.buscador input::placeholder {
  color: #aaa99f;
}

.filter-button {
  background: transparent;
  border: none;
  color: #536b59;
  font-size: 22px;
}


/* CATEGORÍAS */

.categorias {
  display: flex;
  gap: 8px;
  margin: 16px 0 25px;
  overflow-x: auto;
  scrollbar-width: none;
}

.categorias::-webkit-scrollbar {
  display: none;
}

.categorias button {
  flex-shrink: 0;
  padding: 9px 15px;
  border: 1px solid #e4e2d9;
  border-radius: 20px;
  background: white;
  color: #526254;
  font-size: 11px;
}

.categorias button.activa {
  background: #28523d;
  color: white;
  border-color: #28523d;
}

.categorias .mas-button {
  background: transparent;
}


/* TÍTULO DE DESTACADOS */

.seccion-titulo {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.seccion-titulo h3 {
  font-family: Georgia, serif;
  font-size: 22px;
  font-weight: normal;
}

.seccion-titulo button {
  background: transparent;
  border: none;
  color: #42654d;
  font-size: 11px;
}


/* TARJETA DEL DESTINO */

.destination-card {
  background: white;
  border-radius: 13px;
  overflow: hidden;
  box-shadow: 0 3px 12px rgba(35, 55, 40, 0.07);
  cursor: pointer;
  margin-bottom: 16px;
}

.destination-image {
  height: 205px;
  position: relative;
  overflow: hidden;
}

.destination-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.etiqueta {
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(255, 255, 255, 0.92);
  color: #31543d;
  padding: 7px 10px;
  border-radius: 20px;
  font-size: 10px;
}

.favorite {
  position: absolute;
  top: 10px;
  right: 12px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: white;
  color: #31543d;
  font-size: 20px;
}


/* INFORMACIÓN DEL DESTINO */

.destination-info {
  padding: 14px;
}

.destination-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.destination-heading h4 {
  font-family: Georgia, serif;
  font-size: 19px;
  font-weight: normal;
  margin-bottom: 5px;
}

.ubicacion {
  color: #89897f;
  font-size: 11px;
}

.rating {
  font-size: 11px;
  color: #536c48;
  white-space: nowrap;
}

.destination-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 17px;
  padding-top: 12px;
  border-top: 1px solid #eeede7;
}

.precio strong {
  font-size: 16px;
  color: #263b30;
}

.precio span {
  font-size: 10px;
  color: #888;
}

.categoria-label {
  background: #edf1e9;
  color: #45634a;
  padding: 6px 9px;
  border-radius: 15px;
  font-size: 10px;
}


/* SIN RESULTADOS */

.sin-resultados {
  text-align: center;
  padding: 35px 15px;
  color: #526254;
}

.sin-resultados span {
  font-size: 30px;
}

.sin-resultados h3 {
  font-family: Georgia, serif;
  font-weight: normal;
  margin: 12px 0;
}

.sin-resultados p {
  font-size: 12px;
  color: #888;
  margin-bottom: 15px;
}

.sin-resultados button {
  background: #28523d;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 15px;
  font-size: 11px;
}


/* BARRA INFERIOR */

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


/* ADAPTACIÓN A PANTALLAS PEQUEÑAS */

@media (max-width: 350px) {

  .contenido {
    padding-left: 16px;
    padding-right: 16px;
  }

  .bienvenida h2 {
    font-size: 26px;
  }

  .seccion-titulo h3 {
    font-size: 19px;
  }

}

/* ===== CONEXIÓN CON LA API ===== */
.topbar-acciones {
  display: flex;
  align-items: center;
  gap: 10px;
}

.campana {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: #ebe9df;
  color: #365541;
  font-size: 15px;
}

.badge {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #c0463f;
  color: #fff;
  font-family: Arial, sans-serif;
  font-size: 9px;
  line-height: 16px;
  text-align: center;
}

.filter-button {
  position: relative;
}

.badge-filtro {
  background: #28523d;
  top: -4px;
  right: -6px;
}

.consultar {
  font-size: 12px;
}

.ver-mas {
  width: 100%;
  height: 44px;
  margin: 6px 0 10px;
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

/* PANEL DE FILTROS */

.filtros-fondo {
  position: fixed;
  inset: 0;
  background: rgba(20, 35, 27, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 900;
}

.filtros-panel {
  width: 100%;
  max-width: 430px;
  max-height: 88vh;
  overflow-y: auto;
  background: #f7f6f0;
  border-radius: 20px 20px 0 0;
  padding: 24px 22px 28px;
}

.filtros-panel h3 {
  font-family: Georgia, serif;
  font-weight: normal;
  font-size: 22px;
  margin-bottom: 4px;
}

.filtro-titulo {
  font-size: 12px;
  color: #6f7168;
  margin: 18px 0 9px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chips button {
  padding: 9px 14px;
  border: 1px solid #e4e2d9;
  border-radius: 20px;
  background: white;
  color: #526254;
  font-size: 11px;
}

.chips button.activa {
  background: #28523d;
  border-color: #28523d;
  color: white;
}

.rango {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rango input {
  flex: 1;
  min-width: 0;
  height: 42px;
  border: 1px solid #deded5;
  border-radius: 8px;
  padding: 0 12px;
  background: white;
  font-size: 12px;
  color: #263b30;
}

.filtros-acciones {
  display: flex;
  gap: 10px;
  margin-top: 24px;
}

</style>
