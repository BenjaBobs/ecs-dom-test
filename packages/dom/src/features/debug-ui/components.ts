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
  treeEntities: EntityId[];
  selectionEntities: EntityId[];
  timelineEntities: EntityId[];
};

export const DebugUIRenderState = defineComponent<DebugUIRenderStateData>('DebugUIRenderState');

export type DebugUILayoutData = {
  header: EntityId;
  content: EntityId;
  tree: EntityId;
  treeSearchInput: EntityId;
  detail: EntityId;
  selectionSection: EntityId;
  timelineSection: EntityId;
};

export const DebugUILayout = defineComponent<DebugUILayoutData>('DebugUILayout');

export type DebugUISelectionData = {
  entity: EntityId | null;
};

export const DebugUISelection = defineComponent<DebugUISelectionData>('DebugUISelection');

export type DebugUITreeSearchData = {
  query: string;
  lastQuery: string;
};

export const DebugUITreeSearch = defineComponent<DebugUITreeSearchData>('DebugUITreeSearch');

export type DebugUISectionStateData = {
  selectionOpen: boolean;
  timelineOpen: boolean;
};

export const DebugUISectionState = defineComponent<DebugUISectionStateData>('DebugUISectionState');

export type DebugUITreeStateData = {
  expanded: Set<EntityId>;
};

export const DebugUITreeState = defineComponent<DebugUITreeStateData>('DebugUITreeState');

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
  searchHandlers: Map<EntityId, (event: Event) => void>;
  scrollTimers: Map<EntityId, number>;
  pendingScroll: Map<EntityId, EntityId>;
  snapshotThrottleMs: Map<EntityId, number>;
  profileSampleMs: Map<EntityId, number>;
  timelineTimers: Map<EntityId, number>;
  timelinePendingProfiles: Map<EntityId, DebugUITimelineSample>;
  timelineLastSample: Map<EntityId, number>;
  profileSubscriptions: Map<EntityId, () => void>;
  snapshotTimers: Map<EntityId, number>;
  snapshotPending: Set<EntityId>;
  snapshotLastUpdate: Map<EntityId, number>;
  debugEntities: Set<EntityId>;
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
  startTimestamp: number;
  endTimestamp: number;
  totalDuration: number;
  flushCount: number;
  systemExecutions: {
    name: string;
    duration: number;
    entityCount: number;
    entities?: EntityId[];
  }[];
};

export type DebugUITimelineData = {
  samples: DebugUITimelineSample[];
  selectedId: number | null;
  paused: boolean;
  includeDebugUI: boolean;
};

export const DebugUITimeline = defineComponent<DebugUITimelineData>('DebugUITimeline');

export const DebugUITimelineRef = defineComponent<{ id: number }>('DebugUITimelineRef');

export const DebugUIPauseToggle = defineMarker('DebugUIPauseToggle');
export const DebugUIIncludeDebugToggle = defineMarker('DebugUIIncludeDebugToggle');
export const DebugUISectionToggle = defineComponent<{ section: 'selection' | 'timeline' }>(
  'DebugUISectionToggle',
);
export const DebugUITreeToggle = defineComponent<{ id: EntityId }>('DebugUITreeToggle');
export const DebugUITreeSearchInput = defineMarker('DebugUITreeSearchInput');

export type DebugUIConfigData = {
  snapshotThrottleMs: number;
  profileSampleMs: number;
};

export const DebugUIConfig = defineComponent<DebugUIConfigData>('DebugUIConfig');
