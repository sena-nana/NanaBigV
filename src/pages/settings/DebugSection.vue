<script setup lang="ts">
import { useWorkbenchDebugSettings } from "../../composables/useWorkbenchDebug";

const { mockDataSourceEnabled } = useWorkbenchDebugSettings();
</script>

<template>
  <div class="card">
    <h2>调试</h2>

    <div class="settings-row">
      <div class="settings-row__label">
        <div>Mock 数据源</div>
        <div class="settings-row__hint">
          开启后按固定节奏在本地生成主播语音、上下文和互动事件，用于本地联调与回放。
        </div>
      </div>
      <label class="settings-checkbox">
        <input
          v-model="mockDataSourceEnabled"
          type="checkbox"
          aria-label="开启 Mock 数据源"
        />
        <span>{{ mockDataSourceEnabled ? "已开启" : "已关闭" }}</span>
      </label>
    </div>
  </div>
</template>

<style scoped>
.settings-row {
  gap: 12px;
}

.settings-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
}

.settings-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 0;
}
</style>

