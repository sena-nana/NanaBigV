export interface AnchoredMenuPosition {
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
}

export interface MenuTransformOrigin {
  x: number;
  y: number;
}

export type MenuPlacement = "top" | "bottom";

export const SB_MENU_EDGE_PADDING = 4;
export const SB_MENU_GAP = 6;
export const SB_MENU_POP_TRANSITION_MS = 180;
export const SB_LAYER_Z_INDEX = {
  dropdown: 1900,
  contextMenu: 2000,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function createAnchoredMenuPosition(
  x: number,
  y: number,
  anchorX = x,
  anchorY = y,
): AnchoredMenuPosition {
  return { x, y, anchorX, anchorY };
}

export function createPlacedAnchoredMenuPosition(
  triggerRect: DOMRect,
  placement: MenuPlacement,
  height = 0,
  anchorX = triggerRect.left + triggerRect.width / 2,
): AnchoredMenuPosition {
  const y = placement === "bottom"
    ? triggerRect.bottom + SB_MENU_GAP
    : triggerRect.top - height - SB_MENU_GAP;
  const anchorY = placement === "bottom" ? triggerRect.bottom : triggerRect.top;
  return createAnchoredMenuPosition(triggerRect.left, y, anchorX, anchorY);
}

export function clampAnchoredMenuPosition(
  position: AnchoredMenuPosition,
  width: number,
  height: number,
): AnchoredMenuPosition {
  const maxX = Math.max(SB_MENU_EDGE_PADDING, window.innerWidth - width - SB_MENU_EDGE_PADDING);
  const maxY = Math.max(SB_MENU_EDGE_PADDING, window.innerHeight - height - SB_MENU_EDGE_PADDING);
  return {
    ...position,
    x: clamp(position.x, SB_MENU_EDGE_PADDING, maxX),
    y: clamp(position.y, SB_MENU_EDGE_PADDING, maxY),
  };
}

export function resolveMenuTransformOrigin(
  position: AnchoredMenuPosition,
  width = Number.POSITIVE_INFINITY,
  height = Number.POSITIVE_INFINITY,
): MenuTransformOrigin {
  return {
    x: clamp(position.anchorX - position.x, 0, width),
    y: clamp(position.anchorY - position.y, 0, height),
  };
}
