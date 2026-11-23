<template>
  <div v-if="totalPaginas > 1" class="p-paginacion">
    <button class="p-btn sec peq" :disabled="pagina <= 1 || cargando" @click="$emit('cambiar', pagina - 1)">
      ← Anterior
    </button>

    <span>Página {{ pagina }} de {{ totalPaginas }}</span>

    <button class="p-btn sec peq" :disabled="pagina >= totalPaginas || cargando" @click="$emit('cambiar', pagina + 1)">
      Siguiente →
    </button>
  </div>
</template>

<script setup>
defineProps({
  pagina: { type: Number, default: 1 },
  totalPaginas: { type: Number, default: 1 },
  cargando: Boolean
})

defineEmits(['cambiar'])
</script>
