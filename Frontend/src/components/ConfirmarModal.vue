<template>
  <div v-if="abierto" class="modal-fondo" @click.self="$emit('cancelar')">
    <div class="modal" role="dialog" aria-modal="true">
      <h3>{{ titulo }}</h3>
      <p>{{ mensaje }}</p>

      <slot />

      <div class="modal-acciones">
        <button class="btn-secundario" :disabled="cargando" @click="$emit('cancelar')">
          {{ textoCancelar }}
        </button>

        <button
          :class="peligro ? 'btn-peligro' : 'btn-primario'"
          :disabled="cargando || deshabilitado"
          @click="$emit('confirmar')"
        >
          <span v-if="cargando" class="spinner"></span>
          {{ textoConfirmar }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  abierto: Boolean,
  titulo: { type: String, default: '¿Estás seguro?' },
  mensaje: { type: String, default: '' },
  textoConfirmar: { type: String, default: 'Confirmar' },
  textoCancelar: { type: String, default: 'Volver' },
  peligro: Boolean,
  cargando: Boolean,
  deshabilitado: Boolean
})

defineEmits(['confirmar', 'cancelar'])
</script>

<style scoped>
.modal-fondo {
  position: fixed;
  inset: 0;
  background: rgba(20, 35, 27, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
}

.modal {
  width: 100%;
  max-width: 430px;
  background: #f7f6f0;
  border-radius: 20px 20px 0 0;
  padding: 24px 22px 28px;
  color: #263b30;
}

.modal h3 {
  font-family: Georgia, serif;
  font-weight: normal;
  font-size: 20px;
  margin-bottom: 8px;
}

.modal p {
  font-size: 12px;
  color: #6f7168;
  line-height: 1.5;
  margin-bottom: 16px;
}

.modal textarea {
  width: 100%;
  border: 1px solid #deded5;
  border-radius: 8px;
  padding: 10px 11px;
  background: #fff;
  font: inherit;
  font-size: 13px;
  color: #263b30;
  resize: vertical;
  margin-bottom: 8px;
}

@media (min-width: 600px) {
  .modal-fondo { align-items: center; }
  .modal { border-radius: 16px; }
}

.modal-acciones {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}
</style>
