<template>
  <div class="panel-shell">

    <aside class="panel-side">

      <div class="panel-brand">
        <h1>raíz</h1>
        <span>{{ ROLES[sesion.usuario?.rol] }}</span>
      </div>

      <nav class="panel-nav">
        <router-link
          v-for="item in items"
          :key="item.to"
          :to="item.to"
          :class="{ activo: esActivo(item) }"
        >
          <span class="ico">{{ item.icono }}</span>
          {{ item.etiqueta }}
          <span v-if="item.aviso && noLeidas > 0" class="contador">{{ noLeidas }}</span>
        </router-link>
      </nav>

      <div class="panel-user">
        <div>
          <strong>{{ sesion.usuario?.nombre }}</strong>
          <small>{{ sesion.usuario?.correo }}</small>
        </div>

        <button :disabled="saliendo" @click="salir">Cerrar sesión</button>
      </div>

    </aside>

    <main class="panel-main">

      <header class="p-cabecera">
        <div>
          <h1>{{ titulo }}</h1>
          <p v-if="subtitulo">{{ subtitulo }}</p>
        </div>

        <div class="p-cabecera-acciones">
          <slot name="acciones" />
        </div>
      </header>

      <slot />

    </main>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { sesion, ROLES, cerrarSesion } from '../services/auth'
import { contarNoLeidas } from '../services/notificaciones'

defineProps({
  titulo: { type: String, required: true },
  subtitulo: { type: String, default: '' }
})

const route = useRoute()
const router = useRouter()

// Menú según el rol. Los negocios locales no tienen reservas ni disponibilidad.
const items = computed(() => {
  const rol = sesion.usuario?.rol

  if (rol === 'ADMINISTRADOR') {
    return [
      { to: '/admin', etiqueta: 'Resumen', icono: '◈', exacto: true },
      { to: '/admin/usuarios', etiqueta: 'Usuarios', icono: '♙' },
      { to: '/admin/publicaciones', etiqueta: 'Publicaciones', icono: '▤' },
      { to: '/admin/resenas', etiqueta: 'Reseñas', icono: '★' },
      { to: '/admin/denuncias', etiqueta: 'Denuncias', icono: '⚑' },
      { to: '/admin/reservas', etiqueta: 'Reservas', icono: '▣' },
      { to: '/admin/categorias', etiqueta: 'Categorías', icono: '◐' },
      { to: '/admin/notificaciones', etiqueta: 'Notificaciones', icono: '♫', aviso: true },
      { to: '/admin/cuenta', etiqueta: 'Mi cuenta', icono: '⚙' }
    ]
  }

  return [
    { to: '/anfitrion', etiqueta: 'Resumen', icono: '◈', exacto: true },
    { to: '/anfitrion/publicaciones', etiqueta: 'Publicaciones', icono: '▤' },
    ...(rol === 'ANFITRION' ? [{ to: '/anfitrion/reservas', etiqueta: 'Reservas', icono: '▣' }] : []),
    { to: '/anfitrion/notificaciones', etiqueta: 'Notificaciones', icono: '♫', aviso: true },
    { to: '/anfitrion/cuenta', etiqueta: 'Mi cuenta', icono: '⚙' }
  ]
})

const esActivo = (item) => (item.exacto ? route.path === item.to : route.path.startsWith(item.to))

const noLeidas = ref(0)

onMounted(async () => {
  try { noLeidas.value = await contarNoLeidas() } catch { /* el contador es opcional */ }
})

const saliendo = ref(false)

async function salir() {
  saliendo.value = true
  await cerrarSesion()
  router.replace('/')
}
</script>
