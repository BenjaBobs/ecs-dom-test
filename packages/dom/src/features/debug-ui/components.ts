/**
 * Debug UI components.
 */

import { defineComponent, defineMarker, type EntityId, type WorldSnapshot } from '@ecs-test/ecs';

export const DebugUIRoot = defineMarker('DebugUIRoot');

export type DebugUIStateData = {
  snapshot: WorldSnapshot;
};

export const DebugUIState = defineComponent<DebugUIStateData>('DebugUIState');

export type DebugUIRenderStateData = {
  uiEntities: EntityId[];
};

export const DebugUIRenderState = defineComponent<DebugUIRenderStateData>('DebugUIRenderState');

export type DebugUISelectionData = {
  entity: EntityId | null;
};

export const DebugUISelection = defineComponent<DebugUISelectionData>('DebugUISelection');

export type DebugUIPanelStateData = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const DebugUIPanelState = defineComponent<DebugUIPanelStateData>('DebugUIPanelState');

export type DebugUIEntityRefData = { id: EntityId };
export const DebugUIEntityRef = defineComponent<DebugUIEntityRefData>('DebugUIEntityRef');

export const DebugUIHeader = defineMarker('DebugUIHeader');
export const DebugUIVisible = defineMarker('DebugUIVisible');

export type DebugUIRuntimeData = {
  headerHandlers: Map<EntityId, (event: MouseEvent) => void>;
  subscriptions: Map<EntityId, () => void>;
  hotkeyHandlers: Map<EntityId, (event: KeyboardEvent) => void>;
  timelineIntervals: Map<EntityId, number>;
  dragging?: { root: EntityId; offsetX: number; offsetY: number; width: number; height: number };
  moveHandler?: (event: MouseEvent) => void;
  upHandler?: (event: MouseEvent) => void;
  view?: Window | null;
};

export const DebugUIRuntime = defineComponent<DebugUIRuntimeData>('DebugUIRuntime');

export type DebugUIHotkey = {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
};

export const DebugUIHotkeys = defineComponent<{
  keys: DebugUIHotkey[];
}>('DebugUIHotkeys');

export type DebugUITimelineSample = {
  id: number;
  timestamp: number;
  totalDuration: number;
  systemExecutions: { name: string; duration: number; entityCount: number }[];
};

export type DebugUITimelineData = {
  samples: DebugUITimelineSample[];
  selectedId: number | null;
  paused: boolean;
};

export const DebugUITimeline = defineComponent<DebugUITimelineData>('DebugUITimeline');

export const DebugUITimelineRef = defineComponent<{ id: number }>('DebugUITimelineRef');

export const DebugUIPauseToggle = defineMarker('DebugUIPauseToggle');
