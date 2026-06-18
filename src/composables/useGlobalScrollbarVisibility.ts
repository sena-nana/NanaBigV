type Axis = "vertical" | "horizontal";

type ScrollTarget = {
  key: Element;
  scroller: Element | Window;
};

type ScrollMetrics = {
  clientHeight: number;
  clientWidth: number;
  rect: Pick<DOMRect, "top" | "right" | "bottom" | "left" | "width" | "height">;
  scrollHeight: number;
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
};

type ThumbMetrics = {
  domainSize: number;
  thumbOffset: number;
  thumbSize: number;
  trackSize: number;
  visibleSize: number;
};

type OverlayPair = {
  horizontal: HTMLDivElement;
  vertical: HTMLDivElement;
};

type OverlayBinding = {
  axis: Axis;
  target: ScrollTarget;
};

type DragState = OverlayBinding & {
  metrics: ThumbMetrics;
  pointerId: number | null;
  startPointer: number;
  startScroll: number;
};

const HIDE_DELAY = 480;
const HOT_ZONE = 12;
const TRACK_PADDING = 4;
const MIN_THUMB_SIZE = 24;

let installed = false;
let hoverTarget: ScrollTarget | null = null;
let dragState: DragState | null = null;

const hideTimers = new WeakMap<Element, ReturnType<typeof window.setTimeout>>();
const removeTimers = new WeakMap<Element, ReturnType<typeof window.setTimeout>>();
const overlays = new Map<Element, OverlayPair>();
const overlayBindings = new WeakMap<HTMLDivElement, OverlayBinding>();

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function maxScroll(domainSize: number, visibleSize: number): number {
  return Math.max(0, domainSize - visibleSize);
}

function thumbMetrics(input: {
  domainSize: number;
  scrollOffset: number;
  trackSize: number;
  visibleSize: number;
}): ThumbMetrics {
  const visibleSize = Math.max(0, input.visibleSize);
  const domainSize = Math.max(visibleSize, input.domainSize);
  const trackSize = Math.max(0, input.trackSize);
  const scrollOffset = clamp(input.scrollOffset, 0, maxScroll(domainSize, visibleSize));
  const proportionalSize = domainSize > 0 ? (trackSize * visibleSize) / domainSize : 0;
  const thumbSize =
    domainSize - visibleSize > 1
      ? Math.min(trackSize, Math.max(MIN_THUMB_SIZE, proportionalSize))
      : 0;
  const thumbTrackSize = Math.max(0, trackSize - thumbSize);

  return {
    domainSize,
    thumbOffset:
      thumbSize > 0
        ? (thumbTrackSize * scrollOffset) / Math.max(1, maxScroll(domainSize, visibleSize))
        : 0,
    thumbSize,
    trackSize,
    visibleSize,
  };
}

function dragScrollOffset(startScroll: number, pointerDelta: number, metrics: ThumbMetrics): number {
  const scrollRange = maxScroll(metrics.domainSize, metrics.visibleSize);
  const thumbTrackSize = Math.max(1, metrics.trackSize - metrics.thumbSize);
  return clamp(startScroll + (pointerDelta * scrollRange) / thumbTrackSize, 0, scrollRange);
}

function resolveTarget(target: EventTarget | null): ScrollTarget | null {
  if (typeof document === "undefined") return null;
  if (
    target === window ||
    target === document ||
    target === document.documentElement ||
    target === document.body
  ) {
    return { key: document.documentElement, scroller: window };
  }
  return target instanceof Element ? { key: target, scroller: target } : null;
}

function readMetrics(target: ScrollTarget): ScrollMetrics {
  if (target.scroller === window) {
    const scroller = document.scrollingElement ?? document.documentElement;
    return {
      clientHeight: window.innerHeight,
      clientWidth: window.innerWidth,
      rect: {
        top: 0,
        right: window.innerWidth,
        bottom: window.innerHeight,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      },
      scrollHeight: scroller.scrollHeight,
      scrollLeft: scroller.scrollLeft || window.scrollX,
      scrollTop: scroller.scrollTop || window.scrollY,
      scrollWidth: scroller.scrollWidth,
    };
  }

  const element = target.scroller as Element;
  const rect = element.getBoundingClientRect();
  return {
    clientHeight: element.clientHeight,
    clientWidth: element.clientWidth,
    rect,
    scrollHeight: element.scrollHeight,
    scrollLeft: element.scrollLeft,
    scrollTop: element.scrollTop,
    scrollWidth: element.scrollWidth,
  };
}

function isScrollable(metrics: ScrollMetrics): boolean {
  return metrics.scrollHeight > metrics.clientHeight + 1 || metrics.scrollWidth > metrics.clientWidth + 1;
}

function isScrollableAxis(metrics: ScrollMetrics, axis: Axis): boolean {
  return axis === "vertical"
    ? metrics.scrollHeight > metrics.clientHeight + 1
    : metrics.scrollWidth > metrics.clientWidth + 1;
}

function inHotZone(metrics: ScrollMetrics, event: PointerEvent): boolean {
  const { clientX, clientY } = event;
  if (
    clientX < metrics.rect.left ||
    clientX > metrics.rect.right ||
    clientY < metrics.rect.top ||
    clientY > metrics.rect.bottom
  ) {
    return false;
  }

  return (
    (isScrollableAxis(metrics, "vertical") && clientX >= metrics.rect.right - HOT_ZONE) ||
    (isScrollableAxis(metrics, "horizontal") && clientY >= metrics.rect.bottom - HOT_ZONE)
  );
}

function findHoverTarget(event: PointerEvent): ScrollTarget | null {
  for (const node of event.composedPath()) {
    const target = node instanceof Element ? resolveTarget(node) : null;
    if (!target) continue;
    const metrics = readMetrics(target);
    if (isScrollable(metrics) && inHotZone(metrics, event)) return target;
  }

  const documentTarget = resolveTarget(document);
  if (!documentTarget) return null;
  const metrics = readMetrics(documentTarget);
  return isScrollable(metrics) && inHotZone(metrics, event) ? documentTarget : null;
}

function clearTimer(map: WeakMap<Element, ReturnType<typeof window.setTimeout>>, target: Element) {
  const timer = map.get(target);
  if (timer === undefined) return;
  window.clearTimeout(timer);
  map.delete(target);
}

function removeOverlay(target: Element) {
  const overlay = overlays.get(target);
  if (!overlay) return;
  overlayBindings.delete(overlay.vertical);
  overlayBindings.delete(overlay.horizontal);
  overlay.vertical.remove();
  overlay.horizontal.remove();
  overlays.delete(target);
}

function ensureOverlay(target: Element): OverlayPair {
  const existing = overlays.get(target);
  if (existing) return existing;

  const overlay = {
    vertical: document.createElement("div"),
    horizontal: document.createElement("div"),
  };
  overlay.vertical.className = "global-scrollbar-overlay global-scrollbar-overlay--vertical";
  overlay.horizontal.className = "global-scrollbar-overlay global-scrollbar-overlay--horizontal";
  overlay.vertical.addEventListener("pointerdown", onOverlayPointerDown);
  overlay.horizontal.addEventListener("pointerdown", onOverlayPointerDown);
  document.body.append(overlay.vertical, overlay.horizontal);
  overlays.set(target, overlay);
  return overlay;
}

function updateOverlayAxis(
  element: HTMLDivElement,
  target: ScrollTarget,
  axis: Axis,
  metrics: ScrollMetrics,
) {
  const visible = isScrollableAxis(metrics, axis);
  overlayBindings.set(element, { axis, target });
  element.classList.toggle("is-visible", visible);

  if (!visible) {
    return;
  }

  const vertical = axis === "vertical";
  const thumb = thumbMetrics({
    domainSize: vertical ? metrics.scrollHeight : metrics.scrollWidth,
    scrollOffset: vertical ? metrics.scrollTop : metrics.scrollLeft,
    trackSize: Math.max(0, (vertical ? metrics.rect.height : metrics.rect.width) - TRACK_PADDING * 2),
    visibleSize: vertical ? metrics.clientHeight : metrics.clientWidth,
  });

  if (vertical) {
    element.style.top = `${metrics.rect.top + TRACK_PADDING + thumb.thumbOffset}px`;
    element.style.right = `${Math.max(0, window.innerWidth - metrics.rect.right)}px`;
    element.style.height = `${thumb.thumbSize}px`;
    return;
  }

  element.style.left = `${metrics.rect.left + TRACK_PADDING + thumb.thumbOffset}px`;
  element.style.bottom = `${Math.max(0, window.innerHeight - metrics.rect.bottom)}px`;
  element.style.width = `${thumb.thumbSize}px`;
}

function updateOverlay(target: ScrollTarget) {
  const metrics = readMetrics(target);
  if (!isScrollable(metrics)) {
    removeOverlay(target.key);
    return;
  }

  clearTimer(removeTimers, target.key);
  const overlay = ensureOverlay(target.key);
  updateOverlayAxis(overlay.vertical, target, "vertical", metrics);
  updateOverlayAxis(overlay.horizontal, target, "horizontal", metrics);
}

function hideOverlay(target: Element) {
  const overlay = overlays.get(target);
  if (!overlay) return;
  overlay.vertical.classList.remove("is-visible");
  overlay.horizontal.classList.remove("is-visible");
  clearTimer(removeTimers, target);
  removeTimers.set(
    target,
    window.setTimeout(() => {
      removeOverlay(target);
      removeTimers.delete(target);
    }, HIDE_DELAY),
  );
}

function hideSoon(target: ScrollTarget) {
  clearTimer(hideTimers, target.key);
  hideTimers.set(
    target.key,
    window.setTimeout(() => {
      hideOverlay(target.key);
      hideTimers.delete(target.key);
    }, HIDE_DELAY),
  );
}

function show(target: ScrollTarget) {
  clearTimer(hideTimers, target.key);
  updateOverlay(target);
}

function axisMetrics(target: ScrollTarget, axis: Axis) {
  const metrics = readMetrics(target);
  const vertical = axis === "vertical";
  return {
    metrics,
    thumb: thumbMetrics({
      domainSize: vertical ? metrics.scrollHeight : metrics.scrollWidth,
      scrollOffset: vertical ? metrics.scrollTop : metrics.scrollLeft,
      trackSize: Math.max(0, (vertical ? metrics.rect.height : metrics.rect.width) - TRACK_PADDING * 2),
      visibleSize: vertical ? metrics.clientHeight : metrics.clientWidth,
    }),
  };
}

function setScroll(target: ScrollTarget, axis: Axis, value: number) {
  const metrics = readMetrics(target);
  if (target.scroller === window) {
    window.scrollTo(
      axis === "horizontal" ? value : metrics.scrollLeft,
      axis === "vertical" ? value : metrics.scrollTop,
    );
    return;
  }

  const element = target.scroller as Element;
  if (axis === "vertical") element.scrollTop = value;
  else element.scrollLeft = value;
}

function onOverlayPointerDown(event: PointerEvent) {
  const binding = overlayBindings.get(event.currentTarget as HTMLDivElement);
  if (!binding) return;

  const { metrics, thumb } = axisMetrics(binding.target, binding.axis);
  const vertical = binding.axis === "vertical";
  event.preventDefault();
  event.stopPropagation();
  show(binding.target);
  dragState = {
    ...binding,
    metrics: thumb,
    pointerId: Number.isFinite(event.pointerId) ? event.pointerId : null,
    startPointer: vertical ? event.clientY : event.clientX,
    startScroll: vertical ? metrics.scrollTop : metrics.scrollLeft,
  };
  window.addEventListener("pointerup", onDragPointerEnd, true);
  window.addEventListener("pointercancel", onDragPointerEnd, true);
}

function onDragPointerMove(event: PointerEvent) {
  if (!dragState || (dragState.pointerId !== null && event.pointerId !== dragState.pointerId)) return;
  const pointer = dragState.axis === "vertical" ? event.clientY : event.clientX;
  event.preventDefault();
  setScroll(
    dragState.target,
    dragState.axis,
    dragScrollOffset(dragState.startScroll, pointer - dragState.startPointer, dragState.metrics),
  );
  show(dragState.target);
}

function onDragPointerEnd(event: PointerEvent) {
  if (!dragState || (dragState.pointerId !== null && event.pointerId !== dragState.pointerId)) return;
  const target = dragState.target;
  dragState = null;
  hideSoon(target);
  window.removeEventListener("pointerup", onDragPointerEnd, true);
  window.removeEventListener("pointercancel", onDragPointerEnd, true);
}

function onScroll(event: Event) {
  const target = resolveTarget(event.target);
  if (!target) return;
  show(target);
  hideSoon(target);
}

function onPointerMove(event: PointerEvent) {
  if (dragState) {
    onDragPointerMove(event);
    return;
  }

  const target = findHoverTarget(event);
  if (target) {
    if (hoverTarget?.key && hoverTarget.key !== target.key) hideSoon(hoverTarget);
    hoverTarget = target;
    show(target);
    return;
  }

  if (hoverTarget) {
    hideSoon(hoverTarget);
    hoverTarget = null;
  }
}

function onPointerLeave() {
  if (!hoverTarget) return;
  hideSoon(hoverTarget);
  hoverTarget = null;
}

export function uninstallGlobalScrollbarVisibility() {
  if (!installed || typeof window === "undefined") return;
  installed = false;
  window.removeEventListener("scroll", onScroll, true);
  window.removeEventListener("pointermove", onPointerMove, true);
  window.removeEventListener("pointerleave", onPointerLeave);
  window.removeEventListener("pointerup", onDragPointerEnd, true);
  window.removeEventListener("pointercancel", onDragPointerEnd, true);
  hoverTarget = null;
  dragState = null;
  overlays.forEach((_overlay, target) => {
    clearTimer(hideTimers, target);
    clearTimer(removeTimers, target);
    removeOverlay(target);
  });
}

export function installGlobalScrollbarVisibility() {
  if (installed || typeof window === "undefined") return uninstallGlobalScrollbarVisibility;
  installed = true;
  window.addEventListener("scroll", onScroll, { capture: true, passive: true });
  window.addEventListener("pointermove", onPointerMove, { capture: true });
  window.addEventListener("pointerleave", onPointerLeave);
  return uninstallGlobalScrollbarVisibility;
}
