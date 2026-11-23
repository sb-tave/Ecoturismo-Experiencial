<template>
  <main class="notif-page">

    <header class="notif-header">

      <button class="volver" @click="router.push('/perfil')" aria-label="Volver">
        ←
      </button>

      <div>
        <small>RAÍZ · AVISOS</small>
        <h1>Notificaciones</h1>
      </div>

      <button
        v-if="noLeidas > 0"
        class="marcar-todas"
        :disabled="marcando"
        @click="marcarTodas"
      >
        Marcar todas
      </button>

    </header>

    <div v-if="cargando" class="bloque-cargando">
      <span class="spinner"></span> Cargando…
    </div>

    <p v-else-if="error" class="aviso-error">
      {{ error }}
      <button @click="cargar">Reintentar</button>
    </p>

    <section v-else-if="items.length === 0" class="vacio">
      <span>🌿</span>
      <h2>Todo al día</h2>
      <p>Cuando reserves o pagues, tus avisos aparecerán aquí.</p>
    </section>

    <section v-else class="lista">

      <button
        v-for="n in items"
        :key="n.id_notificacion"
        class="notif"
        :class="{ nueva: !n.leida }"
        @click="abrir(n)"
      >

        <span class="icono" :class="claseTipo(n.tipo)">{{ iconoTipo(n.tipo) }}</span>

        <span class="texto">
          <strong>{{ tituloTipo(n.tipo) }}</strong>
          <span>{{ n.mensaje }}</span>
          <small>{{ fechaHora(n.fecha_envio) }}</small>
        </span>

        <span v-if="!n.leida" class="punto-nuevo"></span>

      </button>

      <button
        v-if="pagina < totalPaginas"
        class="ver-mas"
        :disabled="cargandoMas"
        @click="cargarMas"
      >
        {{ cargandoMas ? 'Cargando…' : 'Ver más' }}
      </button>

    </section>

  </main>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { listarNotificaciones, marcarLeida, marcarTodasLeidas } from '../services/notificaciones'
import { mensajeError } from '../services/api'
import { fechaHora } from '../utils/formato'

const router = useRouter()

const items = ref([])
const pagina = ref(1)
const totalPaginas = ref(1)
const noLeidas = ref(0)

const cargando = ref(true)
const cargandoMas = ref(false)
const marcando = ref(false)
const error = ref('')

const TIPOS = {
  PAGO_APROBADO: { titulo: 'Pago aprobado', icono: '✓', clase: 'ok' },
  NUEVA_RESERVA: { titulo: 'Reserva confirmada', icono: '▣', clase: 'ok' },
  RESERVA_CANCELADA: { titulo: 'Reserva cancelada', icono: '✕', clase: 'mal' },
  NUEVA_CALIFICACION: { titulo: 'Nueva calificación', icono: '★', clase: 'info' }
}

const tituloTipo = (t) => TIPOS[t]?.titulo ?? 'Aviso'
const iconoTipo = (t) => TIPOS[t]?.icono ?? '●'
const claseTipo = (t) => TIPOS[t]?.clase ?? 'info'

async function cargar() {
  cargando.value = true
  error.value = ''

  try {
    const r = await listarNotificaciones({ page: 1, limit: 15 })

    items.value = r.data
    pagina.value = 1
    totalPaginas.value = r.meta.total_pages
    noLeidas.value = r.meta.no_leidas
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos cargar tus notificaciones.')
  } finally {
    cargando.value = false
  }
}

async function cargarMas() {
  cargandoMas.value = true

  try {
    const r = await listarNotificaciones({ page: pagina.value + 1, limit: 15 })

    items.value = [...items.value, ...r.data]
    pagina.value += 1
    totalPaginas.value = r.meta.total_pages
  } catch (e) {
    error.value = mensajeError(e)
  } finally {
    cargandoMas.value = false
  }
}

async function abrir(n) {
  if (!n.leida) {
    try {
      await marcarLeida(n.id_notificacion)
      n.leida = true
      noLeidas.value = Math.max(0, noLeidas.value - 1)
    } catch {
      // Si falla, igual se navega
    }
  }

  if (['PAGO_APROBADO', 'NUEVA_RESERVA', 'RESERVA_CANCELADA'].includes(n.tipo)) {
    router.push('/mis-reservas')
  }
}

async function marcarTodas() {
  marcando.value = true

  try {
    await marcarTodasLeidas()
    items.value.forEach((n) => { n.leida = true })
    noLeidas.value = 0
  } catch (e) {
    error.value = mensajeError(e)
  } finally {
    marcando.value = false
  }
}

onMounted(cargar)
</script>

<style scoped>

.notif-page {
  width: 100%;
  max-width: 430px;
  min-height: 100vh;
  margin: 0 auto;
  padding: 20px 20px 40px;
  background: #f7f6f0;
  color: #263b30;
}

.notif-header {
  display: flex;
  align-items: center;
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

.notif-header > div {
  flex: 1;
}

.notif-header small {
  font-size: 8px;
  letter-spacing: 1px;
  color: #8a8c80;
}

.notif-header h1 {
  font-family: Georgia, serif;
  font-weight: normal;
  font-size: 25px;
  margin-top: 4px;
}

.marcar-todas {
  border: none;
  background: transparent;
  color: #28523d;
  font-size: 11px;
  text-decoration: underline;
}

.lista {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.notif {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 13px;
  border: 1px solid #ece9df;
  border-radius: 12px;
  background: white;
  color: inherit;
  text-align: left;
}

.notif.nueva {
  border-color: #cfe0c9;
  background: #f6faf3;
}

.icono {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 14px;
}

.icono.ok { background: #e1eedf; color: #28523d; }
.icono.mal { background: #f4e3e3; color: #a33a3a; }
.icono.info { background: #e8ebf3; color: #3b4f7a; }

.texto {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.texto strong {
  font-size: 12px;
}

.texto span {
  font-size: 11.5px;
  line-height: 1.45;
  color: #55604f;
  overflow-wrap: anywhere;
}

.texto small {
  font-size: 10px;
  color: #9a9a90;
}

.punto-nuevo {
  width: 8px;
  height: 8px;
  margin-top: 5px;
  border-radius: 50%;
  background: #c0463f;
  flex-shrink: 0;
}

.vacio {
  text-align: center;
  padding: 60px 20px;
}

.vacio span {
  font-size: 36px;
}

.vacio h2 {
  font-family: Georgia, serif;
  font-weight: normal;
  font-size: 21px;
  margin: 12px 0 6px;
}

.vacio p {
  font-size: 12px;
  color: #77776f;
}

.ver-mas {
  width: 100%;
  height: 44px;
  background: white;
  border: 1px solid #d9dccf;
  border-radius: 10px;
  color: #28523d;
  font-size: 12px;
}

</style>
