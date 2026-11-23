<template>
  <ConfirmarModal
    :abierto="abierto"
    :titulo="titulo"
    :mensaje="mensaje"
    :texto-confirmar="textoConfirmar"
    :peligro="peligro"
    :cargando="cargando"
    :deshabilitado="obligatorio && motivo.trim().length < 5"
    @confirmar="$emit('confirmar', motivo.trim())"
    @cancelar="$emit('cancelar')"
  >
    <label class="etiqueta">Motivo {{ obligatorio ? '(mínimo 5 caracteres)' : '(opcional)' }}</label>

    <textarea v-model="motivo" rows="3" maxlength="200" placeholder="Escribe el motivo…"></textarea>

    <p v-if="error" class="aviso-error">{{ error }}</p>
  </ConfirmarModal>
</template>

<script setup>
import { ref, watch } from 'vue'

import ConfirmarModal from './ConfirmarModal.vue'

const props = defineProps({
  abierto: Boolean,
  titulo: { type: String, default: 'Indica el motivo' },
  mensaje: { type: String, default: '' },
  textoConfirmar: { type: String, default: 'Confirmar' },
  peligro: Boolean,
  cargando: Boolean,
  obligatorio: { type: Boolean, default: true },
  error: { type: String, default: '' }
})

defineEmits(['confirmar', 'cancelar'])

const motivo = ref('')

// Cada vez que se abre, el campo empieza vacío
watch(() => props.abierto, (abierto) => {
  if (abierto) motivo.value = ''
})
</script>

<style scoped>
.etiqueta {
  display: block;
  font-size: 11px;
  color: #6f7168;
  margin-bottom: 6px;
}
</style>
