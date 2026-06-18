<script setup lang="ts">
defineProps<{
  label: string;
  tone?: "ok" | "warn" | "error" | "info";
}>();
</script>

<template>
  <span class="status-badge" :class="`is-${tone ?? 'info'}`">{{ label }}</span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 9px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2px;
  white-space: nowrap;
}

.status-badge.is-ok {
  background: var(--ok-soft);
  color: var(--ok);
}

.status-badge.is-warn {
  background: var(--warn-soft);
  color: var(--warn);
}

.status-badge.is-error {
  background: var(--err-soft);
  color: var(--err);
}

.status-badge.is-info {
  background: var(--accent-soft);
  color: var(--accent);
}
</style>
