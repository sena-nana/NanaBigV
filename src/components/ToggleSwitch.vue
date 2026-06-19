<script setup lang="ts">
interface ToggleSwitchProps {
  modelValue: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}

const props = defineProps<ToggleSwitchProps>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();

function onToggle(event: Event) {
  const target = event.target as HTMLInputElement | null;
  emit("update:modelValue", target?.checked ?? false);
}
</script>

<template>
  <label class="toggle-switch">
    <input
      class="toggle-switch__input"
      type="checkbox"
      :checked="props.modelValue"
      :disabled="props.disabled"
      :aria-label="props.ariaLabel"
      @change="onToggle"
    />
    <span class="toggle-switch__track"></span>
  </label>
</template>

<style scoped>
.toggle-switch {
  position: relative;
  display: inline-flex;
  width: 40px;
  height: 22px;
  flex: 0 0 auto;
}

.toggle-switch__input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
  z-index: 2;
}

.toggle-switch__track {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-soft);
  background: var(--bg-hover);
  display: block;
  position: relative;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.toggle-switch__track::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--bg);
  box-shadow: 0 1px 3px color-mix(in srgb, var(--text-faint) 40%, transparent);
  transition: transform 0.2s ease, background-color 0.2s ease;
}

.toggle-switch__input:checked + .toggle-switch__track {
  border-color: var(--accent);
  background: var(--accent);
}

.toggle-switch__input:checked + .toggle-switch__track::after {
  transform: translateX(18px);
  background: var(--accent-text);
}

.toggle-switch__input:focus-visible + .toggle-switch__track {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.toggle-switch__input:disabled + .toggle-switch__track {
  cursor: not-allowed;
  opacity: 0.55;
}

</style>
