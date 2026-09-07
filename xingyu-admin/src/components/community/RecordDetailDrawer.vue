<template>
  <n-drawer v-model:show="show" :width="width">
    <n-drawer-content :title="title">
      <n-descriptions bordered :column="1">
        <n-descriptions-item v-for="field in fields" :key="field.label" :label="field.label">
          <span v-if="field.multiline" class="detail-multiline">{{ field.value }}</span>
          <template v-else>{{ field.value }}</template>
        </n-descriptions-item>
      </n-descriptions>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
export interface DetailField {
  label: string
  value: string
  multiline?: boolean
}

const show = defineModel<boolean>('show', { required: true })

withDefaults(
  defineProps<{
    title: string
    fields: DetailField[]
    width?: number
  }>(),
  { width: 520 }
)
</script>

<style scoped lang="scss">
.detail-multiline {
  display: block;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}
</style>
