import { ref, watch } from "vue";
import { APP_METADATA } from "../config/appShell";

export type CornerStyle = "smooth" | "round";

const STORAGE_KEY = `${APP_METADATA.storageKeyPrefix}.corners`;
const RADIUS_STORAGE_KEY = `${APP_METADATA.storageKeyPrefix}.cornerRadius`;
const DEFAULT_CORNER_STYLE: CornerStyle = "smooth";
export const CORNER_RADIUS_MIN = 0;
export const CORNER_RADIUS_MAX = 20;
export const DEFAULT_CORNER_RADIUS = 8;

function loadInitial(): CornerStyle {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "smooth" || stored === "round") return stored;
  } catch {
    // localStorage 不可用时回到默认圆角。
  }
  return DEFAULT_CORNER_STYLE;
}

function clampRadius(value: number): number {
  return Math.min(CORNER_RADIUS_MAX, Math.max(CORNER_RADIUS_MIN, value));
}

function loadInitialRadius(): number {
  try {
    const stored = localStorage.getItem(RADIUS_STORAGE_KEY);
    const parsed = stored === null ? NaN : Number.parseFloat(stored);
    if (Number.isFinite(parsed)) return clampRadius(parsed);
  } catch {
    // localStorage 不可用时回到默认半径。
  }
  return DEFAULT_CORNER_RADIUS;
}

function applyCornerPreferences(style: CornerStyle, radius: number): void {
  document.documentElement.dataset.corners = style;
  document.documentElement.style.setProperty("--app-corner-radius", `${clampRadius(radius)}px`);
  try {
    localStorage.setItem(STORAGE_KEY, style);
    localStorage.setItem(RADIUS_STORAGE_KEY, String(clampRadius(radius)));
  } catch {
    // ignore
  }
}

const cornerStyle = ref<CornerStyle>(loadInitial());
const cornerRadius = ref(loadInitialRadius());
watch(
  [cornerStyle, cornerRadius],
  ([style, radius]) => applyCornerPreferences(style, radius),
  { flush: "sync", immediate: true },
);

export function useCornerStyle() {
  applyCornerPreferences(cornerStyle.value, cornerRadius.value);

  return {
    cornerStyle,
    cornerRadius,
    setCornerStyle(next: CornerStyle) {
      cornerStyle.value = next;
    },
    setCornerRadius(next: number) {
      cornerRadius.value = clampRadius(next);
    },
  };
}
