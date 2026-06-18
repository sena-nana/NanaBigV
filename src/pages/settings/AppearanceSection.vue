<script setup lang="ts">
import { Moon, Radius, SquareRoundCorner, Sun } from "@lucide/vue";
import {
  CORNER_RADIUS_MAX,
  CORNER_RADIUS_MIN,
  useCornerStyle,
} from "../../composables/useCornerStyle";
import { useTheme } from "../../composables/useTheme";

const { theme, setTheme } = useTheme();
const { cornerStyle, cornerRadius, setCornerRadius, setCornerStyle } = useCornerStyle();

function onCornerRadiusInput(event: Event) {
  setCornerRadius(Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="card">
    <h2>外观</h2>
    <div class="settings-row">
      <div class="settings-row__label">
        <div>主题</div>
        <div class="settings-row__hint">选择应用配色，立即生效并记忆到本地。</div>
      </div>
      <div class="segmented" role="radiogroup" aria-label="主题">
        <button
          type="button"
          role="radio"
          :aria-checked="theme === 'dark'"
          :class="{ 'is-active': theme === 'dark' }"
          @click="setTheme('dark')"
        >
          <Moon :size="14" aria-hidden="true" />
          暗色
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="theme === 'light'"
          :class="{ 'is-active': theme === 'light' }"
          @click="setTheme('light')"
        >
          <Sun :size="14" aria-hidden="true" />
          浅色
        </button>
      </div>
    </div>
    <div class="settings-row">
      <div class="settings-row__label">
        <div>语言</div>
        <div class="settings-row__hint">模板默认使用简体中文界面文案。</div>
      </div>
      <span class="muted">简体中文</span>
    </div>
    <div class="settings-row">
      <div class="settings-row__label">
        <div>圆角</div>
        <div class="settings-row__hint">选择平滑超椭圆或普通圆角，立即全局生效。</div>
      </div>
      <div class="segmented" role="radiogroup" aria-label="圆角">
        <button
          type="button"
          role="radio"
          :aria-checked="cornerStyle === 'smooth'"
          :class="{ 'is-active': cornerStyle === 'smooth' }"
          @click="setCornerStyle('smooth')"
        >
          <SquareRoundCorner :size="14" aria-hidden="true" />
          平滑
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="cornerStyle === 'round'"
          :class="{ 'is-active': cornerStyle === 'round' }"
          @click="setCornerStyle('round')"
        >
          <Radius :size="14" aria-hidden="true" />
          普通
        </button>
      </div>
    </div>
    <div class="settings-row">
      <div class="settings-row__label">
        <div>圆角半径</div>
        <div class="settings-row__hint">调节普通与平滑圆角的全局半径。</div>
      </div>
      <div class="radius-control">
        <input
          type="range"
          :min="CORNER_RADIUS_MIN"
          :max="CORNER_RADIUS_MAX"
          step="1"
          :value="cornerRadius"
          aria-label="圆角半径"
          @input="onCornerRadiusInput"
        />
        <output>{{ cornerRadius }}px</output>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-soft);
}

.settings-row:first-child {
  padding-top: 4px;
}

.settings-row:last-child {
  border-bottom: 0;
  padding-bottom: 4px;
}

.settings-row__label {
  min-width: 0;
}

.settings-row__hint {
  color: var(--text-muted);
  font-size: 12px;
  margin-top: 2px;
}

.segmented {
  display: inline-flex;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 2px;
  gap: 2px;
  height: 34px;
}

.segmented button {
  background: transparent;
  color: var(--text-muted);
  border: 0;
  height: 28px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.segmented button:hover:not(.is-active) {
  background: var(--bg-hover);
  color: var(--text);
  filter: none;
}

.segmented button.is-active {
  background: var(--bg-active);
  color: var(--text);
  filter: none;
}

.radius-control {
  display: grid;
  grid-template-columns: minmax(140px, 220px) 44px;
  align-items: center;
  gap: 10px;
}

.radius-control input {
  width: 100%;
  padding-inline: 0;
}

.radius-control output {
  color: var(--text-muted);
  font-size: 12px;
  text-align: right;
}

@media (max-width: 900px) {
  .settings-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .radius-control {
    width: 100%;
    grid-template-columns: minmax(0, 1fr) 44px;
  }
}
</style>
