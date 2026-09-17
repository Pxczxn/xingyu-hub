<template>
  <button type="button" class="community-table-link" @click="onClick">
    <span v-if="authorParts" class="community-table-link__text">
      <span class="community-table-link__primary">{{ authorParts.left }}</span>
      <span class="community-table-link__sep" aria-hidden="true">|</span>
      <span class="community-table-link__secondary">{{ authorParts.right }}</span>
    </span>
    <span v-else class="community-table-link__text">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label: string
  onClick: () => void
}>()

const authorParts = computed(() => {
  const marker = ' | '
  const index = props.label.indexOf(marker)
  if (index === -1) return null
  const left = props.label.slice(0, index).trim()
  const right = props.label.slice(index + marker.length).trim()
  if (!left || !right) return null
  return { left, right }
})
</script>

<style scoped lang="scss">
.community-table-link {
  display: block;
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 3px 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--xingyu-violet, #5d5aa8);
  font: inherit;
  font-size: 13px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    box-shadow 0.15s ease;

  &__text {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__primary {
    font-weight: 600;
    color: #243250;
    transition: color 0.15s ease;
  }

  &__sep {
    margin: 0 5px;
    color: #c5cad6;
    font-weight: 400;
  }

  &__secondary {
    font-weight: 500;
    color: var(--xingyu-violet, #5d5aa8);
  }

  &:hover {
    background: rgb(93 90 168 / 0.08);

    .community-table-link__primary {
      color: var(--xingyu-violet, #5d5aa8);
    }

    .community-table-link__secondary {
      color: #4a4690;
    }
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgb(93 90 168 / 0.28);
  }
}

.community-table-link:not(:has(.community-table-link__primary)) {
  font-weight: 600;
  color: var(--xingyu-violet, #5d5aa8);

  &:hover {
    color: #4a4690;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
}
</style>
