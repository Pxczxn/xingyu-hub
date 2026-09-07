<template>
  <button type="button" class="community-table-link" @click="onClick">{{ label }}</button>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  onClick: () => void
}>()
</script>

<style scoped lang="scss">
.community-table-link {
  border: none;
  background: none;
  padding: 0;
  color: #6964b8;
  font: inherit;
  text-align: left;
  cursor: pointer;
  max-width: 100%;

  &:hover {
    text-decoration: underline;
  }
}
</style>
