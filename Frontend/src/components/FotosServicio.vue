<template>
  <section class="p-card">

    <h2>Fotografías</h2>

    <p class="ayuda">
      JPG, PNG o WebP, máximo 5 MB cada una y hasta 10 por publicación. La foto principal es la que se ve en las tarjetas del catálogo.
    </p>

    <p v-if="error" class="aviso-error">{{ error }}</p>

    <div class="fotos">

      <figure v-for="f in fotos" :key="f.id_foto" class="foto">
        <img :src="f.url" alt="Foto de la publicación">

        <span v-if="f.es_principal" class="p-badge ok principal">Principal</span>

        <figcaption>
          <button
            v-if="!f.es_principal"
            class="p-btn sec peq"
            :disabled="trabajando === f.id_foto"
            @click="hacerPrincipal(f)"
          >
            Hacer principal
          </button>

          <button class="p-btn mal peq" :disabled="trabajando === f.id_foto" @click="quitar(f)">
            Eliminar
          </button>
        </figcaption>
      </figure>

      <label v-if="fotos.length < 10" class="subir" :class="{ ocupado: subiendo }">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          :disabled="subiendo"
          @change="elegir"
        >
        <span v-if="subiendo" class="spinner"></span>
        <span v-else>＋</span>
        <small>{{ subiendo ? 'Subiendo…' : 'Agregar foto' }}</small>
      </label>

    </div>

  </section>
</template>

<script setup>
import { ref } from 'vue'

import { subirFoto, actualizarFoto, eliminarFoto } from '../services/anfitrion'
import { mensajeError } from '../services/api'

const props = defineProps({
  idServicio: { type: Number, required: true },
  fotos: { type: Array, default: () => [] }
})

const emit = defineEmits(['cambio'])

const subiendo = ref(false)
const trabajando = ref(null)
const error = ref('')

const TIPOS_VALIDOS = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

async function elegir(evento) {
  const archivo = evento.target.files?.[0]
  evento.target.value = '' // permite volver a elegir el mismo archivo

  if (!archivo) return

  error.value = ''

  if (!TIPOS_VALIDOS.includes(archivo.type)) {
    error.value = 'Formato no permitido. Usa JPG, PNG o WebP.'
    return
  }

  if (archivo.size > MAX_BYTES) {
    error.value = 'La imagen supera los 5 MB.'
    return
  }

  subiendo.value = true

  try {
    await subirFoto(props.idServicio, archivo)
    emit('cambio')
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos subir la foto.')
  } finally {
    subiendo.value = false
  }
}

async function hacerPrincipal(foto) {
  trabajando.value = foto.id_foto
  error.value = ''

  try {
    await actualizarFoto(props.idServicio, foto.id_foto, { es_principal: true })
    emit('cambio')
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos cambiar la foto principal.')
  } finally {
    trabajando.value = null
  }
}

async function quitar(foto) {
  trabajando.value = foto.id_foto
  error.value = ''

  try {
    await eliminarFoto(props.idServicio, foto.id_foto)
    emit('cambio')
  } catch (e) {
    error.value = mensajeError(e, 'No pudimos eliminar la foto.')
  } finally {
    trabajando.value = null
  }
}
</script>

<style scoped>
.fotos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.foto {
  position: relative;
  border: 1px solid #ece9df;
  border-radius: 10px;
  overflow: hidden;
  background: #fdfdfb;
}

.foto img {
  display: block;
  width: 100%;
  height: 110px;
  object-fit: cover;
}

.foto figcaption {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
}

.principal {
  position: absolute;
  top: 8px;
  left: 8px;
}

.subir {
  min-height: 160px;
  border: 1.5px dashed #c8cbbf;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #28523d;
  cursor: pointer;
  font-size: 24px;
}

.subir small {
  font-size: 12px;
}

.subir input {
  display: none;
}

.subir.ocupado {
  opacity: 0.6;
  cursor: wait;
}
</style>
