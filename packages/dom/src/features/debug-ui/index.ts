/**
 * Debug UI exports.
 */

import type { EntityId, World } from '@ecs-test/ecs';
import { Style } from '../style/components.ts';
import {
  DebugUIConfig,
  type DebugUIHotkey,
  DebugUIHotkeys,
  DebugUIPanelState,
  DebugUIRenderState,
  DebugUIRoot,
  DebugUISelection,
  DebugUIVisible,
} from './components.ts';
import {
  DebugUIHeaderDragSystem,
  DebugUIHotkeySystem,
  DebugUIInitSystem,
  DebugUILayoutSystem,
  DebugUIRootStyleSystem,
  DebugUISubscriptionCleanupSystem,
  DebugUITimelineRenderSystem,
  DebugUITreeSearchInputSystem,
  DebugUITreeSelectionRenderSystem,
  DebugUIVisibilitySystem,
} from './systems.ts';

export {
  DebugUIConfig,
  DebugUIHeader,
  type DebugUIHotkey,
  DebugUIHotkeys,
  DebugUILayout,
  DebugUIPanelState,
  DebugUIRenderState,
  DebugUIRoot,
  DebugUIRuntime,
  DebugUISectionState,
  DebugUISelection,
  DebugUIState,
  DebugUITimeline,
  DebugUITreeSearch,
  DebugUITreeSearchInput,
  DebugUITreeState,
  DebugUIVisible,
} from './components.ts';

export {
  DebugUIHeaderDragSystem,
  DebugUIHotkeySystem,
  DebugUIInitSystem,
  DebugUILayoutSystem,
  DebugUIRootStyleSystem,
  DebugUISubscriptionCleanupSystem,
  DebugUITimelineRenderSystem,
  DebugUITreeSearchInputSystem,
  DebugUITreeSelectionRenderSystem,
  DebugUIVisibilitySystem,
} from './systems.ts';

export type DebugUIOptions = {
  position?: { x: number; y: number; width: number; height: number };
  hotkeys?: DebugUIHotkey[];
  visible?: boolean;
  snapshotThrottleMs?: number;
  profileSampleMs?: number;
};

export function registerDebugUISystems(world: World): void {
  world.registerSystem(DebugUIInitSystem);
  world.registerSystem(DebugUIRootStyleSystem);
  world.registerSystem(DebugUILayoutSystem);
  world.registerSystem(DebugUITreeSelectionRenderSystem);
  world.registerSystem(DebugUITimelineRenderSystem);
  world.registerSystem(DebugUITreeSearchInputSystem);
  world.registerSystem(DebugUIHeaderDragSystem);
  world.registerSystem(DebugUIVisibilitySystem);
  world.registerSystem(DebugUIHotkeySystem);
  world.registerSystem(DebugUISubscriptionCleanupSystem);
}

/**
 * Create a debug UI panel.
 *
 * @param world - The ECS world
 * @param options - Optional panel position and size
 * @returns The entity ID of the debug UI root
 */
export function createDebugUI(world: World, options: DebugUIOptions = {}): EntityId {
  const root = world.createEntity(null, [DebugUIRoot()]);

  if (options.position) {
    world.set(
      root,
      DebugUIPanelState({
        x: options.position.x,
        y: options.position.y,
        width: options.position.width,
        height: options.position.height,
      }),
    );
  }

  if (options.hotkeys) {
    world.set(root, DebugUIHotkeys({ keys: options.hotkeys }));
  }

  if (options.visible) {
    world.add(root, DebugUIVisible());
  }

  if (options.snapshotThrottleMs !== undefined || options.profileSampleMs !== undefined) {
    world.set(
      root,
      DebugUIConfig({
        snapshotThrottleMs: options.snapshotThrottleMs ?? 120,
        profileSampleMs: options.profileSampleMs ?? 250,
      }),
    );
  }

  if (!world.has(root, DebugUISelection)) {
    world.set(root, DebugUISelection({ entity: null }));
  }

  if (!world.has(root, DebugUIRenderState)) {
    world.set(
      root,
      DebugUIRenderState({ treeEntities: [], selectionEntities: [], timelineEntities: [] }),
    );
  }

  if (!world.has(root, Style)) {
    world.set(root, Style({}));
  }

  return root;
}
