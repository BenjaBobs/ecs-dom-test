/**
 * Debug UI systems.
 */

import type { ComponentInstance } from '@ecs-test/ecs';
import {
  added,
  addedOrReplaced,
  defineReactiveSystem,
  type EntityId,
  type FlushProfile,
  removed,
  type World,
  type WorldSnapshot,
} from '@ecs-test/ecs';
import { DOMElement } from '../../dom-element-components.ts';
import { getDOMElements } from '../../dom-element-systems.ts';
import { Classes } from '../classes/components.ts';
import { Clickable, Clicked } from '../clickable/components.ts';
import { Style } from '../style/components.ts';
import { TextContent } from '../text/components.ts';
import {
  DebugUIConfig,
  type DebugUIConfigData,
  DebugUIEntityRef,
  type DebugUIEntityRefData,
  DebugUIHeader,
  type DebugUIHotkey,
  DebugUIHotkeys,
  DebugUIIncludeDebugToggle,
  DebugUILayout,
  type DebugUILayoutData,
  DebugUIPanelState,
  type DebugUIPanelStateData,
  DebugUIPauseToggle,
  DebugUIRenderState,
  type DebugUIRenderStateData,
  DebugUIRoot,
  DebugUIRuntime,
  type DebugUIRuntimeData,
  DebugUISectionState,
  type DebugUISectionStateData,
  DebugUISectionToggle,
  DebugUISelection,
  type DebugUISelectionData,
  DebugUIState,
  type DebugUIStateData,
  DebugUITimeline,
  type DebugUITimelineData,
  DebugUITimelineRef,
  type DebugUITimelineSample,
  DebugUITreeSearch,
  type DebugUITreeSearchData,
  DebugUITreeSearchInput,
  DebugUITreeState,
  type DebugUITreeStateData,
  DebugUITreeToggle,
  DebugUIVisible,
} from './components.ts';

const defaultPanelState = {
  x: 24,
  y: 24,
  width: 420,
  height: 520,
};

const defaultHotkeys: DebugUIHotkey[] = [{ key: 'd', ctrl: true, shift: true }];

const panelBaseStyle: Partial<CSSStyleDeclaration> = {
  position: 'fixed',
  zIndex: '9999',
  backgroundColor: '#0b0e12',
  color: '#cbd5e1',
  border: '1px solid #1e293b',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: '12px',
  lineHeight: '1.4',
  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
  resize: 'both',
  overflow: 'hidden',
  opacity: '0.75',
};

const headerStyle: Partial<CSSStyleDeclaration> = {
  backgroundColor: '#111827',
  padding: '6px 8px',
  cursor: 'move',
  userSelect: 'none',
  fontWeight: '600',
  borderBottom: '1px solid #1e293b',
};

const contentStyle: Partial<CSSStyleDeclaration> = {
  display: 'flex',
  height: 'calc(100% - 28px)',
  overflow: 'hidden',
};

const treeStyle: Partial<CSSStyleDeclaration> = {
  flex: '1 1 55%',
  overflow: 'auto',
  borderRight: '1px solid #1e293b',
};

const detailStyle: Partial<CSSStyleDeclaration> = {
  flex: '1 1 45%',
  overflow: 'auto',
};

const detailHeaderStyle: Partial<CSSStyleDeclaration> = {
  padding: '6px 8px',
  borderBottom: '1px solid #1e293b',
  fontWeight: '600',
};

const detailSectionStyle: Partial<CSSStyleDeclaration> = {
  padding: '0 8px',
  whiteSpace: 'pre-wrap',
};

const rowBaseStyle: Partial<CSSStyleDeclaration> = {
  padding: '2px 6px',
  whiteSpace: 'nowrap',
};

const rowContainerStyle: Partial<CSSStyleDeclaration> = {
  ...rowBaseStyle,
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
};

const rowSelectedStyle: Partial<CSSStyleDeclaration> = {
  backgroundColor: '#1f2937',
};

const treeToggleStyle: Partial<CSSStyleDeclaration> = {
  width: '14px',
  display: 'inline-block',
  textAlign: 'center',
  color: '#94a3b8',
  cursor: 'pointer',
};

const treeSearchStyle: Partial<CSSStyleDeclaration> = {
  width: 'calc(100% - 12px)',
  margin: '6px',
  padding: '4px 6px',
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '4px',
  color: '#e2e8f0',
  fontSize: '12px',
};

const treeMatchStyle: Partial<CSSStyleDeclaration> = {
  color: '#f8fafc',
  textShadow: 'rgb(122 0 255) 0px 0px 6px, rgb(122 0 255) 0px 0px 6px, rgb(122 0 255) 0px 0px 6px',
};

const sectionHeaderStyle: Partial<CSSStyleDeclaration> = {
  ...detailHeaderStyle,
  cursor: 'pointer',
  userSelect: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const timelineChartStyle: Partial<CSSStyleDeclaration> = {
  padding: '6px 8px',
  display: 'flex',
  gap: '8px',
};

const timelineAxisStyle: Partial<CSSStyleDeclaration> = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  color: '#94a3b8',
  fontSize: '10px',
  width: '44px',
};

const timelineBarsStyle: Partial<CSSStyleDeclaration> = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: '2px',
  height: '48px',
  flex: '1',
};

const timelineBarBaseStyle: Partial<CSSStyleDeclaration> = {
  width: '6px',
  backgroundColor: '#22c55e',
  cursor: 'pointer',
  borderRadius: '2px',
};

const timelineBarSelectedStyle: Partial<CSSStyleDeclaration> = {
  boxShadow: 'rgb(122 0 255) 0px 0px 6px, rgb(122 0 255) 0px 0px 6px, rgb(122 0 255) 0px 0px 6px',
  position: 'relative',
  zIndex: '1',
};

const timelineControlsStyle: Partial<CSSStyleDeclaration> = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 8px',
  borderBottom: '1px solid #1e293b',
};

const pauseButtonStyle: Partial<CSSStyleDeclaration> = {
  padding: '2px 6px',
  borderRadius: '4px',
  border: '1px solid #334155',
  backgroundColor: '#0f172a',
  color: '#e2e8f0',
  cursor: 'pointer',
  fontSize: '11px',
};

function getDebugUIRuntime(world: World): DebugUIRuntimeData {
  const runtimeId = world.getRuntimeEntity();
  let state = world.getMutableAndHandleFlushYourself(runtimeId, DebugUIRuntime);
  if (!state) {
    state = {
      headerHandlers: new Map(),
      subscriptions: new Map(),
      hotkeyHandlers: new Map(),
      searchHandlers: new Map(),
      scrollTimers: new Map(),
      pendingScroll: new Map(),
      snapshotThrottleMs: new Map(),
      profileSampleMs: new Map(),
      timelineTimers: new Map(),
      timelinePendingProfiles: new Map(),
      timelineLastSample: new Map(),
      profileSubscriptions: new Map(),
      snapshotTimers: new Map(),
      snapshotPending: new Set(),
      snapshotLastUpdate: new Map(),
      debugEntities: new Set(),
    };
    world.set(runtimeId, DebugUIRuntime(state));
  }
  return state;
}

function normalizeKey(key: string): string {
  return key.toLowerCase();
}

function matchesHotkey(event: KeyboardEvent, hotkey: DebugUIHotkey): boolean {
  return (
    normalizeKey(event.key) === normalizeKey(hotkey.key) &&
    Boolean(event.ctrlKey) === Boolean(hotkey.ctrl) &&
    Boolean(event.shiftKey) === Boolean(hotkey.shift) &&
    Boolean(event.altKey) === Boolean(hotkey.alt) &&
    Boolean(event.metaKey) === Boolean(hotkey.meta)
  );
}

function findDebugRoot(world: World, entity: EntityId): EntityId | null {
  let current: EntityId | undefined = entity;
  while (current !== undefined) {
    if (world.has(current, DebugUIRoot)) return current;
    current = world.getParent(current);
  }
  return null;
}

function isDescendantOf(world: World, entity: EntityId, root: EntityId): boolean {
  let current: EntityId | undefined = entity;
  while (current !== undefined) {
    if (current === root) return true;
    current = world.getParent(current);
  }
  return false;
}

function filterSnapshot(world: World, root: EntityId): WorldSnapshot {
  const snapshot = world.snapshot();
  const excluded = new Set<EntityId>();

  for (const entity of snapshot.entities) {
    if (isDescendantOf(world, entity.id, root)) {
      excluded.add(entity.id);
    }
  }

  const filteredEntities = snapshot.entities
    .filter(entity => !excluded.has(entity.id))
    .map(entity => ({
      ...entity,
      parent: entity.parent && excluded.has(entity.parent) ? null : entity.parent,
      children: entity.children.filter(child => !excluded.has(child)),
    }));

  const componentCount = filteredEntities.reduce(
    (count, entity) => count + Object.keys(entity.components).length,
    0,
  );

  return {
    entities: filteredEntities,
    systems: snapshot.systems,
    stats: {
      entityCount: filteredEntities.length,
      componentCount,
      systemCount: snapshot.systems.length,
    },
  };
}

function getSnapshotThrottleMs(world: World, root: EntityId): number {
  const runtime = getDebugUIRuntime(world);
  const config = world.get(root, DebugUIConfig) as DebugUIConfigData | undefined;
  const value = config?.snapshotThrottleMs ?? runtime.snapshotThrottleMs.get(root) ?? 120;
  runtime.snapshotThrottleMs.set(root, value);
  return value;
}

function scheduleSnapshotUpdate(world: World, root: EntityId): void {
  if (!world.has(root, DebugUIVisible)) return;

  const runtime = getDebugUIRuntime(world);
  const view = world.getExternals().window;
  if (!view) {
    const snapshot = filterSnapshot(world, root);
    world.set(root, DebugUIState({ snapshot }));
    return;
  }

  const nowTime = Date.now();
  const throttleMs = getSnapshotThrottleMs(world, root);
  const lastSample = runtime.snapshotLastUpdate.get(root) ?? 0;
  const elapsed = nowTime - lastSample;
  if (elapsed >= throttleMs) {
    runtime.snapshotLastUpdate.set(root, nowTime);
    const snapshot = filterSnapshot(world, root);
    world.set(root, DebugUIState({ snapshot }));
    return;
  }

  runtime.snapshotPending.add(root);
  if (!runtime.snapshotTimers.has(root)) {
    const delay = Math.max(0, throttleMs - elapsed);
    const timerId = view.setTimeout(() => {
      runtime.snapshotTimers.delete(root);
      if (!runtime.snapshotPending.has(root)) return;
      runtime.snapshotPending.delete(root);
      if (!world.has(root, DebugUIVisible)) return;

      const time = Date.now();
      runtime.snapshotLastUpdate.set(root, time);
      const snapshot = filterSnapshot(world, root);
      world.set(root, DebugUIState({ snapshot }));
    }, delay);
    runtime.snapshotTimers.set(root, timerId);
  }
}

function panelStyle(state: DebugUIPanelStateData): Partial<CSSStyleDeclaration> {
  return {
    left: `${state.x}px`,
    top: `${state.y}px`,
    width: `${state.width}px`,
    height: `${state.height}px`,
  };
}

function buildEntityList(
  snapshot: WorldSnapshot,
  expanded: Set<EntityId>,
  allowed?: Set<EntityId>,
): { id: EntityId; depth: number; summary: string; hasChildren: boolean; expanded: boolean }[] {
  const entries: {
    id: EntityId;
    depth: number;
    summary: string;
    hasChildren: boolean;
    expanded: boolean;
  }[] = [];
  const entityMap = new Map(snapshot.entities.map(entity => [entity.id, entity]));

  const roots = snapshot.entities.filter(entity => {
    if (!allowed) {
      return entity.parent === null;
    }
    if (!allowed.has(entity.id)) return false;
    if (entity.parent === null) return true;
    return !allowed.has(entity.parent);
  });

  const walk = (entityId: EntityId, depth: number) => {
    const entity = entityMap.get(entityId);
    if (!entity) return;
    const tags = Object.keys(entity.components);
    const summary = `Entity ${entity.id}${tags.length ? ` (${tags.join(', ')})` : ''}`;
    const childIds = allowed
      ? entity.children.filter(child => allowed.has(child))
      : entity.children;
    const hasChildren = childIds.length > 0;
    const isExpanded = expanded.has(entity.id);
    entries.push({ id: entity.id, depth, summary, hasChildren, expanded: isExpanded });
    if (hasChildren && isExpanded) {
      for (const child of childIds) {
        walk(child, depth + 1);
      }
    }
  };

  for (const root of roots) {
    walk(root.id, 0);
  }

  return entries;
}

function getSelectedEntitySnapshot(snapshot: WorldSnapshot, selected: EntityId | null) {
  if (!selected) return null;
  return snapshot.entities.find(entity => entity.id === selected) ?? null;
}

function createElementEntity(
  world: World,
  parent: EntityId,
  tag: keyof HTMLElementTagNameMap,
  text?: string,
  styles?: Partial<CSSStyleDeclaration>,
  classes?: string[],
): EntityId {
  const components: ComponentInstance[] = [DOMElement({ tag })];
  if (text) components.push(TextContent({ value: text }));
  if (styles) components.push(Style(styles));
  if (classes) components.push(Classes({ list: classes }));
  return world.createEntity(parent, components);
}

function createDebugUIElementEntity(
  world: World,
  parent: EntityId,
  tag: keyof HTMLElementTagNameMap,
  text?: string,
  styles?: Partial<CSSStyleDeclaration>,
  classes?: string[],
): EntityId {
  const entity = createElementEntity(world, parent, tag, text, styles, classes);
  getDebugUIRuntime(world).debugEntities.add(entity);
  return entity;
}

function clearEntities(world: World, entities: EntityId[]): void {
  for (const entity of entities) {
    world.removeEntity(entity);
  }
}

function getTimelineData(world: World, root: EntityId): DebugUITimelineData {
  return (
    (world.get(root, DebugUITimeline) as DebugUITimelineData | undefined) ?? {
      samples: [],
      selectedId: null,
      paused: false,
      includeDebugUI: false,
    }
  );
}

function selectTimelineSample(
  samples: DebugUITimelineSample[],
  selectedId: number | null,
): DebugUITimelineSample | null {
  if (selectedId == null) return samples.at(-1) ?? null;
  return samples.find(sample => sample.id === selectedId) ?? null;
}

function formatDuration(duration: number): string {
  return `${duration.toFixed(2)}ms`;
}

function safeFormatValue(value: unknown): string {
  if (value === undefined) return '';
  try {
    const seen = new WeakSet();
    return JSON.stringify(value, (_key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      if (typeof val === 'function') return '[Function]';
      return val;
    });
  } catch {
    try {
      return String(value);
    } catch {
      return '[Unserializable]';
    }
  }
}

function appendHighlightedText(
  world: World,
  parent: EntityId,
  text: string,
  tokens: string[],
): void {
  const normalizedText = text.toLowerCase();
  const normalizedTokens = tokens.map(token => token.toLowerCase()).filter(Boolean);
  if (normalizedTokens.length === 0) {
    createDebugUIElementEntity(world, parent, 'span', text);
    return;
  }

  let currentIndex = 0;
  while (currentIndex < text.length) {
    let nextIndex = -1;
    let nextToken = '';

    for (const token of normalizedTokens) {
      const idx = normalizedText.indexOf(token, currentIndex);
      if (idx === -1) continue;
      if (
        nextIndex === -1 ||
        idx < nextIndex ||
        (idx === nextIndex && token.length > nextToken.length)
      ) {
        nextIndex = idx;
        nextToken = token;
      }
    }

    if (nextIndex === -1) {
      const remaining = text.slice(currentIndex);
      if (remaining) createDebugUIElementEntity(world, parent, 'span', remaining);
      break;
    }

    const before = text.slice(currentIndex, nextIndex);
    if (before) createDebugUIElementEntity(world, parent, 'span', before);

    const matched = text.slice(nextIndex, nextIndex + nextToken.length);
    createDebugUIElementEntity(world, parent, 'span', matched, treeMatchStyle);

    currentIndex = nextIndex + nextToken.length;
  }
}

type InputElementLike = {
  value: string;
  placeholder?: string;
  type?: string;
  addEventListener(event: string, handler: (event: Event) => void): void;
  removeEventListener(event: string, handler: (event: Event) => void): void;
};

function isInputElement(el: unknown): el is InputElementLike {
  return (
    !!el &&
    typeof el === 'object' &&
    'value' in el &&
    typeof (el as { value?: unknown }).value === 'string'
  );
}

const maxTimelineSamples = 20;

function pushTimelineSample(world: World, root: EntityId, profile: DebugUITimelineSample): void {
  const timeline = getTimelineData(world, root);
  const selectedId = timeline.selectedId;
  const nextSamples = [...timeline.samples, profile].slice(-maxTimelineSamples);
  world.set(
    root,
    DebugUITimeline({
      samples: nextSamples,
      selectedId:
        selectedId && nextSamples.some(sample => sample.id === selectedId) ? selectedId : null,
      paused: timeline.paused,
      includeDebugUI: timeline.includeDebugUI,
    }),
  );
}

type ProfilingExecutionSource = {
  systemExecutions: {
    name: string;
    duration: number;
    entityCount: number;
    entities?: EntityId[];
  }[];
};

function buildTimelineSample(
  profile: FlushProfile,
  systemExecutions: DebugUITimelineSample['systemExecutions'],
): DebugUITimelineSample {
  const totalDuration = systemExecutions.reduce((sum, system) => sum + system.duration, 0);
  const nowTime = Date.now();
  return {
    id: profile.id,
    startTimestamp: nowTime,
    endTimestamp: nowTime,
    totalDuration,
    systemExecutions,
    flushCount: 1,
  };
}

function mergeTimelineSamples(
  base: DebugUITimelineSample,
  incoming: DebugUITimelineSample,
): DebugUITimelineSample {
  const mergedExecutions = new Map<
    string,
    { name: string; duration: number; entityCount: number }
  >();

  for (const system of base.systemExecutions) {
    mergedExecutions.set(system.name, {
      name: system.name,
      duration: system.duration,
      entityCount: system.entityCount,
    });
  }

  for (const system of incoming.systemExecutions) {
    const existing = mergedExecutions.get(system.name);
    if (existing) {
      existing.duration += system.duration;
      existing.entityCount += system.entityCount;
    } else {
      mergedExecutions.set(system.name, {
        name: system.name,
        duration: system.duration,
        entityCount: system.entityCount,
      });
    }
  }

  return {
    id: incoming.id,
    startTimestamp: base.startTimestamp,
    endTimestamp: incoming.endTimestamp,
    totalDuration: base.totalDuration + incoming.totalDuration,
    systemExecutions: Array.from(mergedExecutions.values()),
    flushCount: base.flushCount + incoming.flushCount,
  };
}

function filterProfileExecutions(
  world: World,
  root: EntityId,
  profile: ProfilingExecutionSource,
  includeDebugUI: boolean,
  debugEntities: Set<EntityId>,
): DebugUITimelineSample['systemExecutions'] {
  if (includeDebugUI) return profile.systemExecutions;
  return profile.systemExecutions.filter(system => {
    if (!system.entities || system.entities.length === 0) {
      return !system.name.startsWith('DebugUI');
    }
    return system.entities.some(
      entity => !debugEntities.has(entity) && !isDescendantOf(world, entity, root),
    );
  });
}

function getProfileSampleMs(world: World, root: EntityId): number {
  const runtime = getDebugUIRuntime(world);
  const config = world.get(root, DebugUIConfig) as DebugUIConfigData | undefined;
  const value = config?.profileSampleMs ?? runtime.profileSampleMs.get(root) ?? 250;
  runtime.profileSampleMs.set(root, value);
  return value;
}

export const DebugUIInitSystem = defineReactiveSystem({
  name: 'DebugUIInitSystem',
  triggers: [added(DebugUIRoot)],
  execute(entities, world) {
    for (const root of entities) {
      getDebugUIRuntime(world).debugEntities.add(root);
      if (!world.has(root, DebugUIPanelState)) {
        world.set(root, DebugUIPanelState({ ...defaultPanelState }));
      }

      if (!world.has(root, DebugUIHotkeys)) {
        world.set(root, DebugUIHotkeys({ keys: defaultHotkeys }));
      }

      if (!world.has(root, DebugUISelection)) {
        world.set(root, DebugUISelection({ entity: null }));
      }

      if (!world.has(root, DebugUISectionState)) {
        world.set(root, DebugUISectionState({ selectionOpen: true, timelineOpen: true }));
      }

      if (!world.has(root, DebugUITreeState)) {
        world.set(root, DebugUITreeState({ expanded: new Set() }));
      }

      if (!world.has(root, DebugUITreeSearch)) {
        world.set(root, DebugUITreeSearch({ query: '', lastQuery: '' }));
      }

      if (!world.has(root, DebugUIState)) {
        const snapshot = filterSnapshot(world, root);
        world.set(root, DebugUIState({ snapshot }));
      }

      if (!world.has(root, DebugUIRenderState)) {
        world.set(
          root,
          DebugUIRenderState({ treeEntities: [], selectionEntities: [], timelineEntities: [] }),
        );
      }

      if (!world.has(root, DebugUITimeline)) {
        world.set(
          root,
          DebugUITimeline({ samples: [], selectedId: null, paused: false, includeDebugUI: false }),
        );
      }

      const runtime = getDebugUIRuntime(world);

      if (!runtime.subscriptions.has(root)) {
        const unsubscribe = world.onMutation(mutation => {
          if (isDescendantOf(world, mutation.entity, root)) {
            return;
          }

          scheduleSnapshotUpdate(world, root);
        });
        runtime.subscriptions.set(root, unsubscribe);
      }
    }
  },
});

export const DebugUIRootStyleSystem = defineReactiveSystem({
  name: 'DebugUIRootStyleSystem',
  triggers: [addedOrReplaced(DebugUIPanelState)],
  filter: [DebugUIRoot],
  execute(entities, world) {
    for (const root of entities) {
      const panelState = world.get(root, DebugUIPanelState);
      if (!panelState) continue;
      if (!world.has(root, DebugUIVisible)) {
        continue;
      }
      world.set(
        root,
        Style({ ...panelBaseStyle, ...panelStyle(panelState as DebugUIPanelStateData) }),
      );
    }
  },
});

export const DebugUILayoutSystem = defineReactiveSystem({
  name: 'DebugUILayoutSystem',
  triggers: [added(DebugUIVisible), added(DOMElement)],
  filter: [DebugUIRoot],
  execute(entities, world) {
    for (const root of entities) {
      if (!world.has(root, DebugUIVisible)) continue;
      if (world.has(root, DebugUILayout)) continue;
      if (!world.has(root, DOMElement)) {
        world.add(root, DOMElement({ tag: 'div' }));
        continue;
      }

      const header = createDebugUIElementEntity(world, root, 'div', 'ECS Debugger', headerStyle);
      world.add(header, DebugUIHeader());

      const content = createDebugUIElementEntity(world, root, 'div', undefined, contentStyle);
      const tree = createDebugUIElementEntity(world, content, 'div', undefined, treeStyle);
      const treeSearchInput = createDebugUIElementEntity(
        world,
        tree,
        'input',
        undefined,
        treeSearchStyle,
      );
      world.add(treeSearchInput, DebugUITreeSearchInput());
      const detail = createDebugUIElementEntity(world, content, 'div', undefined, detailStyle);
      const selectionSection = createDebugUIElementEntity(world, detail, 'div');
      const timelineSection = createDebugUIElementEntity(world, detail, 'div');

      world.set(
        root,
        DebugUILayout({
          header,
          content,
          tree,
          treeSearchInput,
          detail,
          selectionSection,
          timelineSection,
        }),
      );
    }
  },
});

export const DebugUITreeSelectionRenderSystem = defineReactiveSystem({
  name: 'DebugUITreeSelectionRenderSystem',
  triggers: [
    addedOrReplaced(DebugUIState),
    addedOrReplaced(DebugUISelection),
    addedOrReplaced(DebugUISectionState),
    addedOrReplaced(DebugUITreeState),
    addedOrReplaced(DebugUITreeSearch),
    added(DebugUILayout),
  ],
  filter: [DebugUIRoot, DebugUIVisible, DebugUILayout],
  execute(entities, world) {
    for (const root of entities) {
      const state = world.get(root, DebugUIState) as DebugUIStateData | undefined;
      const layout = world.get(root, DebugUILayout) as DebugUILayoutData | undefined;
      const sectionState = world.get(root, DebugUISectionState) as
        | DebugUISectionStateData
        | undefined;
      const treeState = world.get(root, DebugUITreeState) as DebugUITreeStateData | undefined;
      if (!state || !layout) continue;

      const selection =
        (world.get(root, DebugUISelection) as DebugUISelectionData | undefined)?.entity ?? null;
      const searchState = world.get(root, DebugUITreeSearch) as DebugUITreeSearchData | undefined;
      const searchQuery = searchState?.query ?? '';
      const previousQuery = searchState?.lastQuery ?? '';
      const renderState = world.get(root, DebugUIRenderState) as DebugUIRenderStateData | undefined;
      const previousTree = renderState?.treeEntities ?? [];
      const previousSelection = renderState?.selectionEntities ?? [];

      world.batch(() => {
        const previousTreeEntities = previousTree.filter(
          entity => entity !== layout.treeSearchInput,
        );
        clearEntities(world, previousTreeEntities);
        clearEntities(world, previousSelection);

        const treeEntities: EntityId[] = [];
        const selectionEntities: EntityId[] = [];

        const expanded = new Set(treeState?.expanded ?? []);
        const normalizedQuery = searchQuery.trim().toLowerCase();
        const clearedSearch = normalizedQuery.length === 0 && previousQuery.trim().length > 0;
        const tokens = normalizedQuery
          ? normalizedQuery
              .split(/[\s,;]+/)
              .map(token => token.trim())
              .filter(Boolean)
          : [];
        let allowed: Set<EntityId> | undefined;

        if (normalizedQuery.length === 0) {
          if (expanded.size === 0) {
            const roots = state.snapshot.entities.filter(entity => entity.parent === null);
            for (const entity of roots) {
              expanded.add(entity.id);
            }
            world.set(root, DebugUITreeState({ expanded }));
          }
        } else {
          const entityMap = new Map(state.snapshot.entities.map(entity => [entity.id, entity]));
          const matchSet = new Set<EntityId>();

          for (const entity of state.snapshot.entities) {
            const tags = Object.keys(entity.components);
            const haystack = `entity ${entity.id} ${tags.join(' ')}`.toLowerCase();
            const matchesAll = tokens.every(token => haystack.includes(token));
            if (matchesAll) {
              matchSet.add(entity.id);
            }
          }

          const allowedSet = new Set<EntityId>();
          for (const id of matchSet) {
            allowedSet.add(id);
            const parent = entityMap.get(id)?.parent;
            if (parent != null) allowedSet.add(parent);
          }

          allowed = allowedSet;
          expanded.clear();
          for (const entity of allowedSet) {
            const target = entityMap.get(entity);
            if (!target) continue;
            if (matchSet.has(entity)) continue;
            if (target.children.some(child => allowedSet.has(child))) {
              expanded.add(entity);
            }
          }
        }

        if (clearedSearch && selection != null) {
          const entityMap = new Map(state.snapshot.entities.map(entity => [entity.id, entity]));
          let current = entityMap.get(selection);
          while (current) {
            expanded.add(current.id);
            if (current.parent == null) break;
            current = entityMap.get(current.parent);
          }
          world.set(root, DebugUITreeState({ expanded }));
          world.set(root, DebugUITreeSearch({ query: searchQuery, lastQuery: searchQuery }));
        }

        const entries = buildEntityList(state.snapshot, expanded, allowed);
        if (entries.length === 0) {
          const empty = createDebugUIElementEntity(
            world,
            layout.tree,
            'div',
            normalizedQuery.length > 0 ? 'No matching entities' : 'No entities',
            detailSectionStyle,
          );
          treeEntities.push(empty);
        }
        for (const entry of entries) {
          const isSelected = selection === entry.id;
          const row = createDebugUIElementEntity(world, layout.tree, 'div', undefined, {
            ...rowContainerStyle,
            paddingLeft: `${6 + entry.depth * 12}px`,
            ...(isSelected ? rowSelectedStyle : {}),
          });

          const toggleLabel = entry.hasChildren ? (entry.expanded ? '▾' : '▸') : '•';
          const toggle = createDebugUIElementEntity(world, row, 'span', toggleLabel, {
            ...treeToggleStyle,
            opacity: entry.hasChildren ? '1' : '0.4',
            cursor: entry.hasChildren ? 'pointer' : 'default',
          });
          if (entry.hasChildren) {
            world.add(toggle, Clickable());
            world.add(toggle, DebugUITreeToggle({ id: entry.id }));
          }

          const label = createDebugUIElementEntity(world, row, 'span');
          appendHighlightedText(world, label, entry.summary, tokens);
          world.add(label, Clickable());
          world.add(label, DebugUIEntityRef({ id: entry.id }));

          treeEntities.push(row);
          treeEntities.push(toggle);
          treeEntities.push(label);
        }

        if (normalizedQuery.length === 0 && selection != null) {
          const selectionLabel =
            entries.find(entry => entry.id === selection) != null
              ? treeEntities.find(entity => {
                  const label = getDOMElements(world).get(entity);
                  if (!label || !label.textContent) return false;
                  return label.textContent.startsWith(`Entity ${selection}`);
                })
              : undefined;

          const runtime = getDebugUIRuntime(world);
          if (selectionLabel) {
            runtime.pendingScroll.set(root, selectionLabel);
            const view = world.getExternals().window;
            if (view && !runtime.scrollTimers.has(root)) {
              const timerId = view.setTimeout(() => {
                runtime.scrollTimers.delete(root);
                const target = runtime.pendingScroll.get(root);
                if (!target) return;
                runtime.pendingScroll.delete(root);
                const el = getDOMElements(world).get(target);
                if (el && 'scrollIntoView' in el) {
                  try {
                    (el as HTMLElement).scrollIntoView({ block: 'nearest' });
                  } catch {
                    // ignore scroll errors
                  }
                }
              }, 0);
              runtime.scrollTimers.set(root, timerId);
            }
          }
        }

        const selectionOpen = sectionState?.selectionOpen ?? true;
        const detailHeader = createDebugUIElementEntity(
          world,
          layout.selectionSection,
          'div',
          `Selection ${selectionOpen ? '▾' : '▸'}`,
          sectionHeaderStyle,
        );
        world.add(detailHeader, Clickable());
        world.add(detailHeader, DebugUISectionToggle({ section: 'selection' }));
        selectionEntities.push(detailHeader);

        if (!selectionOpen) {
          world.set(
            root,
            DebugUIRenderState({
              treeEntities,
              selectionEntities,
              timelineEntities: renderState?.timelineEntities ?? [],
            }),
          );
          return;
        }

        const selectedEntity = getSelectedEntitySnapshot(state.snapshot, selection);
        if (!selectedEntity) {
          const empty = createDebugUIElementEntity(
            world,
            layout.selectionSection,
            'div',
            'No entity selected',
            detailSectionStyle,
          );
          selectionEntities.push(empty);
        } else {
          const meta = createDebugUIElementEntity(
            world,
            layout.selectionSection,
            'div',
            `Entity ${selectedEntity.id}`,
            detailSectionStyle,
          );
          selectionEntities.push(meta);

          const componentEntries = Object.entries(selectedEntity.components);
          if (componentEntries.length === 0) {
            const none = createDebugUIElementEntity(
              world,
              layout.selectionSection,
              'div',
              'No components',
              detailSectionStyle,
            );
            selectionEntities.push(none);
          } else {
            for (const [tag, data] of componentEntries) {
              const formatted = safeFormatValue(data);
              const value = formatted ? ` ${formatted}` : '';
              const line = createDebugUIElementEntity(
                world,
                layout.selectionSection,
                'div',
                `${tag}${value}`,
                detailSectionStyle,
              );
              selectionEntities.push(line);
            }
          }
        }

        world.set(
          root,
          DebugUIRenderState({
            treeEntities,
            selectionEntities,
            timelineEntities: renderState?.timelineEntities ?? [],
          }),
        );
      });
    }
  },
});

export const DebugUITimelineRenderSystem = defineReactiveSystem({
  name: 'DebugUITimelineRenderSystem',
  triggers: [
    addedOrReplaced(DebugUITimeline),
    addedOrReplaced(DebugUISectionState),
    added(DebugUILayout),
  ],
  filter: [DebugUIRoot, DebugUIVisible, DebugUILayout],
  execute(entities, world) {
    for (const root of entities) {
      const timeline = getTimelineData(world, root);
      const layout = world.get(root, DebugUILayout) as DebugUILayoutData | undefined;
      const sectionState = world.get(root, DebugUISectionState) as
        | DebugUISectionStateData
        | undefined;
      if (!layout) continue;

      const renderState = world.get(root, DebugUIRenderState) as DebugUIRenderStateData | undefined;
      const previousTimeline = renderState?.timelineEntities ?? [];

      world.batch(() => {
        clearEntities(world, previousTimeline);

        const timelineEntities: EntityId[] = [];

        const timelineOpen = sectionState?.timelineOpen ?? true;
        const sectionHeader = createDebugUIElementEntity(
          world,
          layout.timelineSection,
          'div',
          `Systems (last ${maxTimelineSamples}) ${timelineOpen ? '▾' : '▸'}`,
          sectionHeaderStyle,
        );
        world.add(sectionHeader, Clickable());
        world.add(sectionHeader, DebugUISectionToggle({ section: 'timeline' }));
        timelineEntities.push(sectionHeader);

        if (!timelineOpen) {
          world.set(
            root,
            DebugUIRenderState({
              treeEntities: renderState?.treeEntities ?? [],
              selectionEntities: renderState?.selectionEntities ?? [],
              timelineEntities,
            }),
          );
          return;
        }

        const timelineHeader = createDebugUIElementEntity(
          world,
          layout.timelineSection,
          'div',
          undefined,
          timelineControlsStyle,
        );
        timelineEntities.push(timelineHeader);

        const timelineTitle = createDebugUIElementEntity(
          world,
          timelineHeader,
          'div',
          `last ${maxTimelineSamples} samples`,
          undefined,
        );
        timelineEntities.push(timelineTitle);

        const pauseLabel = timeline.paused ? 'Resume' : 'Pause';
        const pauseButton = createDebugUIElementEntity(
          world,
          timelineHeader,
          'button',
          pauseLabel,
          pauseButtonStyle,
        );
        world.add(pauseButton, Clickable());
        world.add(pauseButton, DebugUIPauseToggle());
        timelineEntities.push(pauseButton);

        const includeLabel = timeline.includeDebugUI ? 'Exclude Debug UI' : 'Include Debug UI';
        const includeButton = createDebugUIElementEntity(
          world,
          timelineHeader,
          'button',
          includeLabel,
          pauseButtonStyle,
        );
        world.add(includeButton, Clickable());
        world.add(includeButton, DebugUIIncludeDebugToggle());
        timelineEntities.push(includeButton);

        const samples = timeline.samples;
        if (samples.length === 0) {
          const empty = createDebugUIElementEntity(
            world,
            layout.timelineSection,
            'div',
            timeline.includeDebugUI ? 'No profiling data yet' : 'No non-debug profiling data yet',
            detailSectionStyle,
          );
          timelineEntities.push(empty);
        } else {
          const selected = selectTimelineSample(samples, timeline.selectedId);
          const maxTotal =
            samples.reduce((max, sample) => Math.max(max, sample.totalDuration), 0) || 1;

          const chart = createDebugUIElementEntity(
            world,
            layout.timelineSection,
            'div',
            undefined,
            timelineChartStyle,
          );
          timelineEntities.push(chart);

          const axis = createDebugUIElementEntity(
            world,
            chart,
            'div',
            undefined,
            timelineAxisStyle,
          );
          timelineEntities.push(axis);

          const axisTop = createDebugUIElementEntity(
            world,
            axis,
            'div',
            formatDuration(maxTotal),
            undefined,
          );
          timelineEntities.push(axisTop);

          const axisBottom = createDebugUIElementEntity(world, axis, 'div', '0ms', undefined);
          timelineEntities.push(axisBottom);

          const bars = createDebugUIElementEntity(
            world,
            chart,
            'div',
            undefined,
            timelineBarsStyle,
          );
          timelineEntities.push(bars);

          for (const sample of samples) {
            const height = Math.max(6, Math.round((sample.totalDuration / maxTotal) * 46));
            const isSelected = selected?.id === sample.id;
            const barColor =
              sample.totalDuration > 5
                ? '#ef4444'
                : sample.totalDuration > 1
                  ? '#facc15'
                  : '#22c55e';
            const bar = createDebugUIElementEntity(world, bars, 'div', undefined, {
              ...timelineBarBaseStyle,
              height: `${height}px`,
              backgroundColor: barColor,
              ...(isSelected ? timelineBarSelectedStyle : {}),
            });
            world.add(bar, Clickable());
            world.add(bar, DebugUITimelineRef({ id: sample.id }));
            timelineEntities.push(bar);
          }

          const activeSample = selected ?? samples.at(-1) ?? null;
          if (activeSample) {
            const sorted = [...activeSample.systemExecutions].sort(
              (a, b) => b.duration - a.duration,
            );
            const timestampLine = createDebugUIElementEntity(
              world,
              layout.timelineSection,
              'div',
              `Timestamp: ${new Date(activeSample.startTimestamp).toISOString()}\n        -> ${new Date(
                activeSample.endTimestamp,
              ).toISOString()}`,
              detailSectionStyle,
            );
            timelineEntities.push(timestampLine);
            const flushCountLine = createDebugUIElementEntity(
              world,
              layout.timelineSection,
              'div',
              `Flushes: ${activeSample.flushCount}`,
              detailSectionStyle,
            );
            timelineEntities.push(flushCountLine);
            const summary = createDebugUIElementEntity(
              world,
              layout.timelineSection,
              'div',
              `Total: ${formatDuration(activeSample.totalDuration)} (${sorted.length} systems)`,
              detailSectionStyle,
            );
            timelineEntities.push(summary);

            for (const system of sorted) {
              const line = createDebugUIElementEntity(
                world,
                layout.timelineSection,
                'div',
                `${system.name} — ${formatDuration(system.duration)} (${system.entityCount} entities)`,
                detailSectionStyle,
              );
              timelineEntities.push(line);
            }
          }
        }

        world.set(
          root,
          DebugUIRenderState({
            treeEntities: renderState?.treeEntities ?? [],
            selectionEntities: renderState?.selectionEntities ?? [],
            timelineEntities,
          }),
        );
      });
    }
  },
});

export const DebugUISelectionSystem = defineReactiveSystem({
  name: 'DebugUISelectionSystem',
  triggers: [added(Clicked)],
  filter: [DebugUIEntityRef],
  execute(entities, world) {
    for (const entity of entities) {
      const target = world.get(entity, DebugUIEntityRef) as DebugUIEntityRefData | undefined;
      if (!target) continue;
      const root = findDebugRoot(world, entity);
      if (!root) continue;

      world.set(root, DebugUISelection({ entity: target.id }));
      world.remove(entity, Clicked);
      world.flush();
    }
  },
});

export const DebugUITimelineSelectionSystem = defineReactiveSystem({
  name: 'DebugUITimelineSelectionSystem',
  triggers: [added(Clicked)],
  filter: [DebugUITimelineRef],
  execute(entities, world) {
    for (const entity of entities) {
      const ref = world.get(entity, DebugUITimelineRef) as { id: number } | undefined;
      if (!ref) continue;
      const root = findDebugRoot(world, entity);
      if (!root) continue;

      const timeline = getTimelineData(world, root);
      world.set(
        root,
        DebugUITimeline({
          samples: timeline.samples,
          selectedId: ref.id,
          paused: timeline.paused,
          includeDebugUI: timeline.includeDebugUI,
        }),
      );
      world.remove(entity, Clicked);
      world.flush();
    }
  },
});

export const DebugUIPauseToggleSystem = defineReactiveSystem({
  name: 'DebugUIPauseToggleSystem',
  triggers: [added(Clicked)],
  filter: [DebugUIPauseToggle],
  execute(entities, world) {
    for (const entity of entities) {
      const root = findDebugRoot(world, entity);
      if (!root) continue;
      const timeline = getTimelineData(world, root);
      world.set(
        root,
        DebugUITimeline({
          samples: timeline.samples,
          selectedId: timeline.selectedId,
          paused: !timeline.paused,
          includeDebugUI: timeline.includeDebugUI,
        }),
      );
      world.remove(entity, Clicked);
      world.flush();
    }
  },
});

export const DebugUIIncludeDebugToggleSystem = defineReactiveSystem({
  name: 'DebugUIIncludeDebugToggleSystem',
  triggers: [added(Clicked)],
  filter: [DebugUIIncludeDebugToggle],
  execute(entities, world) {
    for (const entity of entities) {
      const root = findDebugRoot(world, entity);
      if (!root) continue;
      const timeline = getTimelineData(world, root);
      world.set(
        root,
        DebugUITimeline({
          samples: timeline.samples,
          selectedId: timeline.selectedId,
          paused: timeline.paused,
          includeDebugUI: !timeline.includeDebugUI,
        }),
      );
      world.remove(entity, Clicked);
      world.flush();
    }
  },
});

export const DebugUITreeSearchInputSystem = defineReactiveSystem({
  name: 'DebugUITreeSearchInputSystem',
  triggers: [added(DebugUITreeSearchInput), removed(DebugUITreeSearchInput)],
  execute(entities, world) {
    const domElements = getDOMElements(world);
    const runtime = getDebugUIRuntime(world);

    for (const entity of entities) {
      const el = domElements.get(entity);
      const existing = runtime.searchHandlers.get(entity);
      if (existing && isInputElement(el)) {
        el.removeEventListener('input', existing);
        runtime.searchHandlers.delete(entity);
      }

      if (!world.has(entity, DebugUITreeSearchInput)) continue;
      if (!isInputElement(el)) continue;

      const root = findDebugRoot(world, entity);
      if (!root) continue;

      const handler = () => {
        const currentState = world.get(root, DebugUITreeSearch) as
          | DebugUITreeSearchData
          | undefined;
        const current = currentState?.query;
        const nextQuery = el.value ?? '';
        if (current === nextQuery) return;
        world.set(
          root,
          DebugUITreeSearch({ query: nextQuery, lastQuery: currentState?.query ?? '' }),
        );
        world.flush();
      };

      el.type = 'search';
      el.placeholder = 'Search entities...';
      const currentQuery = (world.get(root, DebugUITreeSearch) as DebugUITreeSearchData | undefined)
        ?.query;
      if (typeof currentQuery === 'string' && el.value !== currentQuery) {
        el.value = currentQuery;
      }

      el.addEventListener('input', handler);
      runtime.searchHandlers.set(entity, handler);
    }
  },
});

export const DebugUISectionToggleSystem = defineReactiveSystem({
  name: 'DebugUISectionToggleSystem',
  triggers: [added(Clicked)],
  filter: [DebugUISectionToggle],
  execute(entities, world) {
    for (const entity of entities) {
      const root = findDebugRoot(world, entity);
      if (!root) continue;
      const toggle = world.get(entity, DebugUISectionToggle) as
        | { section: 'selection' | 'timeline' }
        | undefined;
      if (!toggle) continue;

      const current = (world.get(root, DebugUISectionState) as
        | DebugUISectionStateData
        | undefined) ?? { selectionOpen: true, timelineOpen: true };

      const next =
        toggle.section === 'selection'
          ? { selectionOpen: !current.selectionOpen, timelineOpen: current.timelineOpen }
          : { selectionOpen: current.selectionOpen, timelineOpen: !current.timelineOpen };

      world.set(root, DebugUISectionState(next));
      world.remove(entity, Clicked);
      world.flush();
    }
  },
});

export const DebugUITreeToggleSystem = defineReactiveSystem({
  name: 'DebugUITreeToggleSystem',
  triggers: [added(Clicked)],
  filter: [DebugUITreeToggle],
  execute(entities, world) {
    for (const entity of entities) {
      const root = findDebugRoot(world, entity);
      if (!root) continue;
      const toggle = world.get(entity, DebugUITreeToggle) as { id: EntityId } | undefined;
      if (!toggle) continue;

      const current = (world.get(root, DebugUITreeState) as DebugUITreeStateData | undefined) ?? {
        expanded: new Set(),
      };
      const nextExpanded = new Set(current.expanded);
      if (nextExpanded.has(toggle.id)) {
        nextExpanded.delete(toggle.id);
      } else {
        nextExpanded.add(toggle.id);
      }

      world.set(root, DebugUITreeState({ expanded: nextExpanded }));
      world.remove(entity, Clicked);
      world.flush();
    }
  },
});

export const DebugUIHeaderDragSystem = defineReactiveSystem({
  name: 'DebugUIHeaderDragSystem',
  triggers: [added(DebugUIHeader), removed(DebugUIHeader)],
  execute(entities, world) {
    const domElements = getDOMElements(world);
    const runtime = getDebugUIRuntime(world);

    for (const entity of entities) {
      const el = domElements.get(entity) as HTMLElement | undefined;
      if (!el) continue;

      const root = findDebugRoot(world, entity);
      if (!root) continue;

      const existing = runtime.headerHandlers.get(entity);
      if (existing) {
        el.removeEventListener('mousedown', existing);
        runtime.headerHandlers.delete(entity);
      }

      if (!world.has(entity, DebugUIHeader)) {
        continue;
      }

      const handler = (event: MouseEvent) => {
        if (event.button !== 0) return;
        if ((event.target as HTMLElement | null)?.tagName === 'BUTTON') return;
        const panelState = world.get(root, DebugUIPanelState) as DebugUIPanelStateData | undefined;
        if (!panelState) return;

        const panelEl = domElements.get(root) as HTMLElement | undefined;
        const rect = panelEl?.getBoundingClientRect();
        const width = rect?.width ?? panelState.width;
        const height = rect?.height ?? panelState.height;

        if (width !== panelState.width || height !== panelState.height) {
          world.set(root, DebugUIPanelState({ ...panelState, width, height }));
          world.flush();
        }

        runtime.dragging = {
          root,
          offsetX: event.clientX - panelState.x,
          offsetY: event.clientY - panelState.y,
          width,
          height,
        };

        const view = el.ownerDocument?.defaultView;
        if (!view) return;
        runtime.view = view;

        if (!runtime.moveHandler) {
          runtime.moveHandler = (moveEvent: MouseEvent) => {
            if (!runtime.dragging) return;
            const panel = world.get(runtime.dragging.root, DebugUIPanelState) as
              | DebugUIPanelStateData
              | undefined;
            if (!panel) return;
            world.set(
              runtime.dragging.root,
              DebugUIPanelState({
                ...panel,
                x: moveEvent.clientX - runtime.dragging.offsetX,
                y: moveEvent.clientY - runtime.dragging.offsetY,
                width: runtime.dragging.width,
                height: runtime.dragging.height,
              }),
            );
            world.flush();
          };
        }

        if (!runtime.upHandler) {
          runtime.upHandler = () => {
            const panel = world.get(root, DebugUIPanelState) as DebugUIPanelStateData | undefined;
            const currentEl = domElements.get(root) as HTMLElement | undefined;
            const currentRect = currentEl?.getBoundingClientRect();
            if (panel && currentRect) {
              world.set(
                root,
                DebugUIPanelState({
                  ...panel,
                  width: currentRect.width,
                  height: currentRect.height,
                }),
              );
              world.flush();
            }
            runtime.dragging = undefined;
            if (runtime.view && runtime.moveHandler && runtime.upHandler) {
              runtime.view.removeEventListener('mousemove', runtime.moveHandler);
              runtime.view.removeEventListener('mouseup', runtime.upHandler);
            }
          };
        }

        view.addEventListener('mousemove', runtime.moveHandler);
        view.addEventListener('mouseup', runtime.upHandler);
      };

      el.addEventListener('mousedown', handler);
      runtime.headerHandlers.set(entity, handler);
    }
  },
});

export const DebugUIVisibilitySystem = defineReactiveSystem({
  name: 'DebugUIVisibilitySystem',
  triggers: [added(DebugUIVisible), removed(DebugUIVisible)],
  filter: [DebugUIRoot],
  execute(entities, world) {
    for (const root of entities) {
      if (world.has(root, DebugUIVisible)) {
        world.enableProfiling();
        const view = world.getExternals().window;
        const runtime = getDebugUIRuntime(world);
        runtime.snapshotLastUpdate.set(root, 0);
        runtime.snapshotPending.delete(root);
        const config = world.get(root, DebugUIConfig) as DebugUIConfigData | undefined;
        if (config) {
          runtime.snapshotThrottleMs.set(root, config.snapshotThrottleMs);
          runtime.profileSampleMs.set(root, config.profileSampleMs);
        }
        if (view && !runtime.profileSubscriptions.has(root)) {
          const unsubscribe = world.onFlushProfile(profile => {
            if (!world.has(root, DebugUIVisible)) return;
            const timeline = getTimelineData(world, root);
            if (timeline.paused) return;

            const includeDebugUI = timeline.includeDebugUI;
            const filteredExecutions = filterProfileExecutions(
              world,
              root,
              profile,
              includeDebugUI,
              runtime.debugEntities,
            );
            const sample = buildTimelineSample(profile, filteredExecutions);
            if (sample.totalDuration === 0 && !includeDebugUI) return;

            const nowTime = Date.now();
            const sampleMs = getProfileSampleMs(world, root);
            const lastSampleTime = runtime.timelineLastSample.get(root) ?? 0;

            if (nowTime - lastSampleTime >= sampleMs) {
              runtime.timelineLastSample.set(root, nowTime);
              pushTimelineSample(world, root, sample);
              return;
            }

            const pending = runtime.timelinePendingProfiles.get(root);
            runtime.timelinePendingProfiles.set(
              root,
              pending ? mergeTimelineSamples(pending, sample) : sample,
            );
            if (!runtime.timelineTimers.has(root)) {
              const delay = Math.max(0, sampleMs - (nowTime - lastSampleTime));
              const timerId = view.setTimeout(() => {
                runtime.timelineTimers.delete(root);
                const pending = runtime.timelinePendingProfiles.get(root);
                if (!pending) return;
                runtime.timelinePendingProfiles.delete(root);
                const pendingTimeline = getTimelineData(world, root);
                if (pendingTimeline.paused || !world.has(root, DebugUIVisible)) return;

                const includeDebug = pendingTimeline.includeDebugUI;
                if (pending.totalDuration === 0 && !includeDebug) return;

                const time = Date.now();
                runtime.timelineLastSample.set(root, time);
                pushTimelineSample(world, root, {
                  ...pending,
                  endTimestamp: time,
                });
              }, delay);
              runtime.timelineTimers.set(root, timerId);
            }
          });
          runtime.profileSubscriptions.set(root, unsubscribe);
        }

        const panelState =
          (world.get(root, DebugUIPanelState) as DebugUIPanelStateData | undefined) ??
          defaultPanelState;
        if (!world.has(root, DOMElement)) {
          world.add(root, DOMElement({ tag: 'div' }));
        }
        world.set(root, Style({ ...panelBaseStyle, ...panelStyle(panelState) }));
        const snapshot = filterSnapshot(world, root);
        world.set(root, DebugUIState({ snapshot }));
        const timeline = getTimelineData(world, root);
        world.set(
          root,
          DebugUITimeline({
            samples: timeline.samples,
            selectedId: timeline.selectedId,
            paused: timeline.paused,
            includeDebugUI: timeline.includeDebugUI,
          }),
        );
      } else {
        world.disableProfiling();
        const runtime = getDebugUIRuntime(world);
        const view = world.getExternals().window;
        const unsubscribe = runtime.profileSubscriptions.get(root);
        if (unsubscribe) {
          unsubscribe();
          runtime.profileSubscriptions.delete(root);
        }
        const timerId = runtime.timelineTimers.get(root);
        if (timerId !== undefined && view) {
          view.clearTimeout(timerId);
          runtime.timelineTimers.delete(root);
        }
        runtime.timelinePendingProfiles.delete(root);
        runtime.snapshotPending.delete(root);
        const scrollTimer = runtime.scrollTimers.get(root);
        if (scrollTimer !== undefined && view) {
          view.clearTimeout(scrollTimer);
          runtime.scrollTimers.delete(root);
        }
        runtime.pendingScroll.delete(root);
        const snapshotTimer = runtime.snapshotTimers.get(root);
        if (snapshotTimer !== undefined && view) {
          view.clearTimeout(snapshotTimer);
          runtime.snapshotTimers.delete(root);
        }
        world.set(
          root,
          DebugUITimeline({ samples: [], selectedId: null, paused: false, includeDebugUI: false }),
        );
        const renderState = world.get(root, DebugUIRenderState) as
          | DebugUIRenderStateData
          | undefined;
        const layout = world.get(root, DebugUILayout) as DebugUILayoutData | undefined;
        const treeEntities = renderState?.treeEntities ?? [];
        const selectionEntities = renderState?.selectionEntities ?? [];
        const timelineEntities = renderState?.timelineEntities ?? [];
        world.batch(() => {
          clearEntities(world, treeEntities);
          clearEntities(world, selectionEntities);
          clearEntities(world, timelineEntities);

          if (layout) {
            const layoutEntities = [
              layout.header,
              layout.content,
              layout.tree,
              layout.treeSearchInput,
              layout.detail,
              layout.selectionSection,
              layout.timelineSection,
            ];
            clearEntities(world, layoutEntities);
            world.remove(root, DebugUILayout);
          }

          world.set(
            root,
            DebugUIRenderState({ treeEntities: [], selectionEntities: [], timelineEntities: [] }),
          );
          if (world.has(root, DOMElement)) {
            world.remove(root, DOMElement);
          }
        });
      }
    }
  },
});

export const DebugUIHotkeySystem = defineReactiveSystem({
  name: 'DebugUIHotkeySystem',
  triggers: [added(DebugUIRoot), removed(DebugUIRoot), addedOrReplaced(DebugUIHotkeys)],
  execute(entities, world) {
    const runtime = getDebugUIRuntime(world);
    const view = world.getExternals().window;
    if (!view) return;

    for (const root of entities) {
      const existing = runtime.hotkeyHandlers.get(root);
      if (existing) {
        view.removeEventListener('keydown', existing);
        runtime.hotkeyHandlers.delete(root);
      }

      if (!world.has(root, DebugUIRoot)) {
        continue;
      }

      const hotkeys = world.get(root, DebugUIHotkeys)?.keys ?? defaultHotkeys;

      const handler = (event: KeyboardEvent) => {
        if (event.repeat) return;
        if (!hotkeys.some(hotkey => matchesHotkey(event, hotkey))) {
          return;
        }

        event.preventDefault();

        if (world.has(root, DebugUIVisible)) {
          world.remove(root, DebugUIVisible);
        } else {
          world.add(root, DebugUIVisible());
        }
        world.flush();
      };

      view.addEventListener('keydown', handler);
      runtime.hotkeyHandlers.set(root, handler);
    }
  },
});

export const DebugUISubscriptionCleanupSystem = defineReactiveSystem({
  name: 'DebugUISubscriptionCleanupSystem',
  triggers: [removed(DebugUIRoot)],
  execute(entities, world) {
    const runtime = getDebugUIRuntime(world);
    for (const entity of entities) {
      const unsubscribe = runtime.subscriptions.get(entity);
      if (unsubscribe) {
        unsubscribe();
        runtime.subscriptions.delete(entity);
      }

      const hotkeyHandler = runtime.hotkeyHandlers.get(entity);
      const view = world.getExternals().window;
      if (hotkeyHandler && view) {
        view.removeEventListener('keydown', hotkeyHandler);
      }
      runtime.hotkeyHandlers.delete(entity);

      const profileUnsub = runtime.profileSubscriptions.get(entity);
      if (profileUnsub) {
        profileUnsub();
        runtime.profileSubscriptions.delete(entity);
      }

      const timerId = runtime.timelineTimers.get(entity);
      if (timerId !== undefined && view) {
        view.clearTimeout(timerId);
        runtime.timelineTimers.delete(entity);
      }
      runtime.timelinePendingProfiles.delete(entity);
      runtime.snapshotPending.delete(entity);
      const scrollTimer = runtime.scrollTimers.get(entity);
      if (scrollTimer !== undefined && view) {
        view.clearTimeout(scrollTimer);
        runtime.scrollTimers.delete(entity);
      }
      runtime.pendingScroll.delete(entity);
      const snapshotTimer = runtime.snapshotTimers.get(entity);
      if (snapshotTimer !== undefined && view) {
        view.clearTimeout(snapshotTimer);
        runtime.snapshotTimers.delete(entity);
      }
    }
  },
});
