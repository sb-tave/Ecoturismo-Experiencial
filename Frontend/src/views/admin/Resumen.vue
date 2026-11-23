<template>
  <PanelLayout titulo="Resumen" subtitulo="Reservas, ingresos y actividad de la plataforma.">

    <div class="p-filtros">

      <div class="campo">
        <label for="desde">Desde</label>
        <input id="desde" class="p-input" type="date" v-model="desde">
      </div>

      <div class="campo">
        <label for="hasta">Hasta</label>
        <input id="hasta" class="p-input" type="date" :min="desde" v-model="hasta">
      </div>

      <button class="p-btn" :disabled="cargando" @click="cargar">Aplicar</button>
      <button class="p-btn sec" :disabled="cargando" @click="ultimos30">Últimos 30 días</button>

    </div>

    <p v-if="error" class="aviso-error">{{ error }}</p>

    <div v-if="cargando" class="bloque-cargando"><span class="spinner"></span> Calculando…</div>

    <template v-else-if="datos">

      <p class="rango">Periodo: {{ fechaCorta(datos.rango.desde) }} → {{ fechaCorta(datos.rango.hasta) }}</p>

      <div class="p-grid">

        <div class="p-stat">
          <span>Ingresos aprobados</span>
          <strong>{{ dinero(datos.ingresos.total) }}</strong>
          <small>{{ datos.ingresos.pagos_aprobados }} pagos aprobados</small>
        </div>

        <div class="p-stat">
          <span>Reservas creadas</span>
          <strong>{{ datos.total_reservas }}</strong>
        </div>

        <router-link class="p-stat enlace" :class="{ alerta: datos.denuncias_pendientes > 0 }" to="/admin/denuncias">
          <span>Denuncias pendientes</span>
          <strong>{{ datos.denuncias_pendientes }}</strong>
          <small>{{ datos.denuncias_pendientes > 0 ? 'Ir a revisarlas →' : 'Nada por revisar' }}</small>
        </router-link>

      </div>

      <div class="dos-columnas">

        <section class="p-card">

          <h2>Reservas por estado</h2>

          <div v-if="datos.total_reservas > 0" class="p-barra">
            <i
              v-for="e in estados"
              :key="e.clave"
              :style="{ width: (datos.reservas_por_estado[e.clave] / datos.total_reservas) * 100 + '%', background: e.color }"
            ></i>
          </div>

          <ul class="leyenda">
            <li v-for="e in estados" :key="e.clave">
              <span class="cuadro" :style="{ background: e.color }"></span>
              {{ e.etiqueta }}
              <strong>{{ datos.reservas_por_estado[e.clave] }}</strong>
            </li>
          </ul>

        </section>

        <section class="p-card">

          <h2>Usuarios por rol</h2>

          <ul class="leyenda">
            <li v-for="(n, rol) in datos.usuarios_por_rol" :key="rol">
              {{ ROLES[rol] }}
              <strong>{{ n }}</strong>
            </li>
          </ul>

        </section>

      </div>

      <section class="p-card">

        <h2>Servicios destacados</h2>

        <div v-if="datos.top_servicios.length === 0" class="p-vacio">
          <strong>Sin pagos en este periodo</strong>
          Los servicios con más ingresos aparecerán aquí.
        </div>

        <div v-else class="p-scroll">
          <table class="p-tabla">
            <thead>
              <tr><th>Servicio</th><th>Tipo</th><th class="num">Reservas</th><th class="num">Ingresos</th></tr>
            </thead>
            <tbody>
              <tr v-for="s in datos.top_servicios" :key="s.id_servicio">
                <td>{{ s.titulo }}</td>
                <td>{{ TIPOS[s.tipo]?.etiqueta }}</td>
                <td class="num">{{ s.reservas }}</td>
                <td class="num">{{ dinero(s.ingresos) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

      </section>

    </template>

  </PanelLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'

import PanelLayout from '../../components/PanelLayout.vue'
import { resumenReportes } from '../../services/admin'
import { TIPOS } from '../../services/destinos'
import { ROLES } from '../../services/auth'
import { mensajeError } from '../../services/api'
import { dinero, fechaCorta } from '../../utils/formato'

const estados = [
  { clave: 'CONFIRMADA', etiqueta: 'Confirmadas', color: '#3c8a57' },
  { clave: 'COMPLETADA', etiqueta: 'Realizadas', color: '#4f6ba3' },
  { clave: 'PENDIENTE_PAGO', etiqueta: 'Pendientes de pago', color: '#d99a1f' },
  { clave: 'CANCELADA', etiqueta: 'Canceladas', color: '#c0463f' }
]

const desde = ref('')
const hasta = ref('')
const datos = ref(null)
const cargando = ref(true)
const error = ref('')

async function cargar() {
  cargando.value = true
  error.value = ''

  try {
    // Sin fechas, el backend usa los últimos 30 días
    datos.value = await resumenReportes({ desde: desde.value, hasta: hasta.value })
    desde.value = datos.value.rango.desde
    hasta.value = datos.value.rango.hasta
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos generar el reporte.')
  } finally {
    cargando.value = false
  }
}

function ultimos30() {
  desde.value = ''
  hasta.value = ''
  cargar()
}

onMounted(cargar)
</script>

<style scoped>
.rango {
  font-size: 12px;
  color: #85877e;
  margin-bottom: 14px;
}

.dos-columnas {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 18px;
  align-items: start;
}

.enlace {
  text-decoration: none;
  color: inherit;
}

.leyenda {
  list-style: none;
}

.leyenda li {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 0;
  border-top: 1px solid #f0eee6;
  font-size: 13px;
}

.leyenda li:first-child {
  border-top: none;
}

.leyenda strong {
  margin-left: auto;
  font-weight: normal;
}

.cuadro {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}
</style>
