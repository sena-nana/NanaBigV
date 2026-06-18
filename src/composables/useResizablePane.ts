import { onBeforeUnmount, ref, type Ref } from "vue";
import { usePersistentNumber } from "./usePersistentState";

type ResizeEdge = "left" | "right";

export interface ResizablePaneOptions {
  storageKey: string;
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
  edge: ResizeEdge;
  disabled?: Ref<boolean>;
}

export function useResizablePane(options: ResizablePaneOptions) {
  const clampWidth = (width: number) =>
    Math.min(options.maxWidth, Math.max(options.minWidth, width));

  const width = usePersistentNumber({
    key: options.storageKey,
    defaultValue: options.defaultWidth,
    min: options.minWidth,
    max: options.maxWidth,
  });
  const isResizing = ref(false);

  let startX = 0;
  let startWidth = 0;

  function setWidth(nextWidth: number) {
    width.value = clampWidth(nextWidth);
  }

  function persistWidth() {
    width.value = width.value;
  }

  function resetWidth() {
    width.value = options.defaultWidth;
  }

  function syncWidthFromStorage() {
    try {
      const raw = localStorage.getItem(options.storageKey);
      const value = raw ? Number.parseFloat(raw) : NaN;
      width.value = Number.isFinite(value) ? clampWidth(value) : options.defaultWidth;
    } catch {
      width.value = options.defaultWidth;
    }
  }

  function onPointerMove(event: PointerEvent) {
    const delta = options.edge === "left"
      ? startX - event.clientX
      : event.clientX - startX;
    setWidth(startWidth + delta);
  }

  function onPointerUp(event: PointerEvent) {
    isResizing.value = false;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    (event.target as Element | null)?.releasePointerCapture?.(event.pointerId);
    persistWidth();
  }

  function startResize(event: PointerEvent) {
    if (options.disabled?.value || event.button !== 0) return;
    event.preventDefault();
    isResizing.value = true;
    startX = event.clientX;
    startWidth = width.value;
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  onBeforeUnmount(() => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  });

  return {
    width,
    isResizing,
    minWidth: options.minWidth,
    maxWidth: options.maxWidth,
    setWidth,
    persistWidth,
    resetWidth,
    syncWidthFromStorage,
    startResize,
  };
}
