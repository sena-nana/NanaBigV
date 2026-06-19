<script setup lang="ts">
import { useWorkbenchDebugSettings } from "../../composables/useWorkbenchDebug";
import ToggleSwitch from "../../components/ToggleSwitch.vue";

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
      <div class="settings-checkbox">
        <ToggleSwitch
          v-model="mockDataSourceEnabled"
          aria-label="开启 Mock 数据源"
        />
        <span>{{ mockDataSourceEnabled ? "已开启" : "已关闭" }}</span>
      </div>
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
</style>
