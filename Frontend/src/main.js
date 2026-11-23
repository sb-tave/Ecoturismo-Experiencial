import { createApp } from 'vue'
import './style.css'
import './assets/styles/shared.css'
import './assets/styles/panel.css'
import App from './App.vue'
import router from './router'
import { alExpirarSesion } from './services/api'
import { limpiarSesion } from './services/auth'

// Si el servidor responde 401 (token vencido), se limpia la sesión y se vuelve al login
alExpirarSesion(() => {
  limpiarSesion()
  if (router.currentRoute.value.name !== 'Login') {
    router.replace({ path: '/', query: { expirada: '1' } })
  }
})

createApp(App).use(router).mount('#app')
