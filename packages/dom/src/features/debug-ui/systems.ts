/**
 * Debug UI systems.
 */

import type { ComponentInstance } from '@ecs-test/ecs';
import {
  added,
  addedOrReplaced,
  defineReactiveSystem,
  type EntityId,
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
  DebugUIEntityRef,
  type DebugUIEntityRefData,
  DebugUIHeader,
  type DebugUIHotkey,
  DebugUIHotkeys,
  DebugUIPanelState,
  type DebugUIPanelStateData,
  DebugUIPauseToggle,
  DebugUIRenderState,
  type DebugUIRenderStateData,
  DebugUIRoot,
  DebugUIRuntime,
  type DebugUIRuntimeData,
  DebugUISelection,
  type DebugUISelectionData,
  DebugUIState,
  type DebugUIStateData,
  DebugUITimeline,
  type DebugUITimelineData,
  DebugUITimelineRef,
  type DebugUITimelineSample,
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
  padding: '6px 8px',
};

const rowBaseStyle: Partial<CSSStyleDeclaration> = {
  padding: '2px 6px',
  whiteSpace: 'nowrap',
};

const rowSelectedStyle: Partial<CSSStyleDeclaration> = {
  backgroundColor: '#1f2937',
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
  backgroundColor: '#38bdf8',
  cursor: 'pointer',
  borderRadius: '2px',
};

const timelineBarSelectedStyle: Partial<CSSStyleDeclaration> = {
  backgroundColor: '#f59e0b',
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
      timelineIntervals: new Map(),
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
): { id: EntityId; depth: number; summary: string }[] {
  const entries: { id: EntityId; depth: number; summary: string }[] = [];
  const entityMap = new Map(snapshot.entities.map(entity => [entity.id, entity]));

  const roots = snapshot.entities.filter(entity => entity.parent === null);

  const walk = (entityId: EntityId, depth: number) => {
    const entity = entityMap.get(entityId);
    if (!entity) return;
    const tags = Object.keys(entity.components);
    const summary = `Entity ${entity.id}${tags.length ? ` (${tags.join(', ')})` : ''}`;
    entries.push({ id: entity.id, depth, summary });
    for (const child of entity.children) {
      walk(child, depth + 1);
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

function getTimelineData(world: World, root: EntityId): DebugUITimelineData {
  return (
    (world.get(root, DebugUITimeline) as DebugUITimelineData | undefined) ?? {
      samples: [],
      selectedId: null,
      paused: false,
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

export const DebugUIInitSystem = defineReactiveSystem({
  name: 'DebugUIInitSystem',
  triggers: [added(DebugUIRoot)],
  execute(entities, world) {
    for (const root of entities) {
      if (!world.has(root, DebugUIPanelState)) {
        world.set(root, DebugUIPanelState({ ...defaultPanelState }));
      }

      if (!world.has(root, DebugUIHotkeys)) {
        world.set(root, DebugUIHotkeys({ keys: defaultHotkeys }));
      }

      if (!world.has(root, DebugUISelection)) {
        world.set(root, DebugUISelection({ entity: null }));
      }

      if (!world.has(root, DebugUIState)) {
        const snapshot = filterSnapshot(world, root);
        world.set(root, DebugUIState({ snapshot }));
      }

      if (!world.has(root, DebugUIRenderState)) {
        world.set(root, DebugUIRenderState({ uiEntities: [] }));
      }

      if (!world.has(root, DebugUITimeline)) {
        world.set(root, DebugUITimeline({ samples: [], selectedId: null, paused: false }));
      }

      const runtime = getDebugUIRuntime(world);

      if (!runtime.subscriptions.has(root)) {
        const unsubscribe = world.onMutation(mutation => {
          if (isDescendantOf(world, mutation.entity, root)) {
            return;
          }

          const snapshot = filterSnapshot(world, root);
          world.set(root, DebugUIState({ snapshot }));
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

export const DebugUIRenderSystem = defineReactiveSystem({
  name: 'DebugUIRenderSystem',
  triggers: [
    addedOrReplaced(DebugUIState),
    addedOrReplaced(DebugUISelection),
    addedOrReplaced(DebugUITimeline),
  ],
  filter: [DebugUIRoot, DebugUIVisible],
  execute(entities, world) {
    for (const root of entities) {
      const state = world.get(root, DebugUIState);
      if (!state) continue;

      const selection =
        (world.get(root, DebugUISelection) as DebugUISelectionData | undefined)?.entity ?? null;
      const renderState = world.get(root, DebugUIRenderState) as DebugUIRenderStateData | undefined;
      const previousEntities = renderState?.uiEntities ?? [];

      world.batch(() => {
        for (const entity of previousEntities) {
          world.removeEntity(entity);
        }

        const uiEntities: EntityId[] = [];

        const header = createElementEntity(world, root, 'div', 'ECS Debugger', headerStyle);
        world.add(header, DebugUIHeader());
        uiEntities.push(header);

        const content = createElementEntity(world, root, 'div', undefined, contentStyle);
        uiEntities.push(content);

        const tree = createElementEntity(world, content, 'div', undefined, treeStyle);
        uiEntities.push(tree);

        const detail = createElementEntity(world, content, 'div', undefined, detailStyle);
        uiEntities.push(detail);

        const entries = buildEntityList((state as DebugUIStateData).snapshot);
        for (const entry of entries) {
          const isSelected = selection === entry.id;
          const row = createElementEntity(world, tree, 'div', entry.summary, {
            ...rowBaseStyle,
            paddingLeft: `${6 + entry.depth * 12}px`,
            ...(isSelected ? rowSelectedStyle : {}),
          });
          world.add(row, Clickable());
          world.add(row, DebugUIEntityRef({ id: entry.id }));
          uiEntities.push(row);
        }

        const detailHeader = createElementEntity(
          world,
          detail,
          'div',
          'Selection',
          detailHeaderStyle,
        );
        uiEntities.push(detailHeader);

        const selectedEntity = getSelectedEntitySnapshot(
          (state as DebugUIStateData).snapshot,
          selection,
        );

        if (!selectedEntity) {
          const empty = createElementEntity(
            world,
            detail,
            'div',
            'No entity selected',
            detailSectionStyle,
          );
          uiEntities.push(empty);
        } else {
          const meta = createElementEntity(
            world,
            detail,
            'div',
            `Entity ${selectedEntity.id}`,
            detailSectionStyle,
          );
          uiEntities.push(meta);

          const componentEntries = Object.entries(selectedEntity.components);
          if (componentEntries.length === 0) {
            const none = createElementEntity(
              world,
              detail,
              'div',
              'No components',
              detailSectionStyle,
            );
            uiEntities.push(none);
          } else {
            for (const [tag, data] of componentEntries) {
              const value = data === undefined ? '' : ` ${JSON.stringify(data, null, 0)}`;
              const line = createElementEntity(
                world,
                detail,
                'div',
                `${tag}${value}`,
                detailSectionStyle,
              );
              uiEntities.push(line);
            }
          }
        }

        const timeline = getTimelineData(world, root);
        const timelineHeader = createElementEntity(
          world,
          detail,
          'div',
          undefined,
          timelineControlsStyle,
        );
        uiEntities.push(timelineHeader);

        const timelineTitle = createElementEntity(
          world,
          timelineHeader,
          'div',
          'Systems (last 5s)',
          undefined,
        );
        uiEntities.push(timelineTitle);

        const pauseLabel = timeline.paused ? 'Resume' : 'Pause';
        const pauseButton = createElementEntity(
          world,
          timelineHeader,
          'button',
          pauseLabel,
          pauseButtonStyle,
        );
        world.add(pauseButton, Clickable());
        world.add(pauseButton, DebugUIPauseToggle());
        uiEntities.push(pauseButton);
        const samples = timeline.samples;
        if (samples.length === 0) {
          const empty = createElementEntity(
            world,
            detail,
            'div',
            'No profiling data yet',
            detailSectionStyle,
          );
          uiEntities.push(empty);
        } else {
          const selected = selectTimelineSample(samples, timeline.selectedId);
          const maxTotal =
            samples.reduce((max, sample) => Math.max(max, sample.totalDuration), 0) || 1;

          const chart = createElementEntity(world, detail, 'div', undefined, timelineChartStyle);
          uiEntities.push(chart);

          const axis = createElementEntity(world, chart, 'div', undefined, timelineAxisStyle);
          uiEntities.push(axis);

          const axisTop = createElementEntity(
            world,
            axis,
            'div',
            formatDuration(maxTotal),
            undefined,
          );
          uiEntities.push(axisTop);

          const axisBottom = createElementEntity(world, axis, 'div', '0ms', undefined);
          uiEntities.push(axisBottom);

          const bars = createElementEntity(world, chart, 'div', undefined, timelineBarsStyle);
          uiEntities.push(bars);

          for (const sample of samples) {
            const height = Math.max(6, Math.round((sample.totalDuration / maxTotal) * 46));
            const isSelected = selected?.id === sample.id;
            const bar = createElementEntity(world, bars, 'div', undefined, {
              ...timelineBarBaseStyle,
              height: `${height}px`,
              ...(isSelected ? timelineBarSelectedStyle : {}),
            });
            world.add(bar, Clickable());
            world.add(bar, DebugUITimelineRef({ id: sample.id }));
            uiEntities.push(bar);
          }

          const activeSample = selected ?? samples.at(-1) ?? null;
          if (activeSample) {
            const sorted = [...activeSample.systemExecutions].sort(
              (a, b) => b.duration - a.duration,
            );
            const summary = createElementEntity(
              world,
              detail,
              'div',
              `Total: ${formatDuration(activeSample.totalDuration)} (${sorted.length} systems)`,
              detailSectionStyle,
            );
            uiEntities.push(summary);

            for (const system of sorted) {
              const line = createElementEntity(
                world,
                detail,
                'div',
                `${system.name} — ${formatDuration(system.duration)} (${system.entityCount} entities)`,
                detailSectionStyle,
              );
              uiEntities.push(line);
            }
          }
        }

        world.set(root, DebugUIRenderState({ uiEntities }));
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
        }),
      );
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
        if (view && !runtime.timelineIntervals.has(root)) {
          const intervalId = view.setInterval(() => {
            const profile = world.getLastFlushProfile();
            if (!profile) return;
            const timeline = getTimelineData(world, root);
            if (timeline.paused) return;
            const lastId = timeline.samples.at(-1)?.id;
            if (lastId === profile.id) return;

            const nowTime = Date.now();
            const nextSamples = [
              ...timeline.samples,
              {
                id: profile.id,
                timestamp: nowTime,
                totalDuration: profile.totalDuration,
                systemExecutions: profile.systemExecutions,
              },
            ].filter(sample => nowTime - sample.timestamp <= 5000);

            const selectedId = timeline.selectedId;
            world.set(
              root,
              DebugUITimeline({
                samples: nextSamples,
                selectedId:
                  selectedId && nextSamples.some(sample => sample.id === selectedId)
                    ? selectedId
                    : null,
                paused: timeline.paused,
              }),
            );
          }, 250);
          runtime.timelineIntervals.set(root, intervalId);
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
      } else {
        world.disableProfiling();
        const runtime = getDebugUIRuntime(world);
        const view = world.getExternals().window;
        const intervalId = runtime.timelineIntervals.get(root);
        if (intervalId !== undefined && view) {
          view.clearInterval(intervalId);
          runtime.timelineIntervals.delete(root);
        }
        world.set(root, DebugUITimeline({ samples: [], selectedId: null, paused: false }));
        const renderState = world.get(root, DebugUIRenderState) as
          | DebugUIRenderStateData
          | undefined;
        const uiEntities = renderState?.uiEntities ?? [];
        world.batch(() => {
          for (const entity of uiEntities) {
            world.removeEntity(entity);
          }
          world.set(root, DebugUIRenderState({ uiEntities: [] }));
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
    }
  },
});
