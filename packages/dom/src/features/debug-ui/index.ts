/**
 * Debug UI exports.
 */

import type { EntityId, World } from '@ecs-test/ecs';
import { Style } from '../style/components.ts';
import {
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
  DebugUIPauseToggleSystem,
  DebugUIRenderSystem,
  DebugUIRootStyleSystem,
  DebugUISelectionSystem,
  DebugUISubscriptionCleanupSystem,
  DebugUITimelineSelectionSystem,
  DebugUIVisibilitySystem,
} from './systems.ts';

export {
  DebugUIEntityRef,
  DebugUIHeader,
  type DebugUIHotkey,
  DebugUIHotkeys,
  DebugUIPanelState,
  DebugUIPauseToggle,
  DebugUIRenderState,
  DebugUIRoot,
  DebugUIRuntime,
  DebugUISelection,
  DebugUIState,
  DebugUITimeline,
  DebugUITimelineRef,
  DebugUIVisible,
} from './components.ts';

export {
  DebugUIHeaderDragSystem,
  DebugUIHotkeySystem,
  DebugUIInitSystem,
  DebugUIRenderSystem,
  DebugUIRootStyleSystem,
  DebugUISelectionSystem,
  DebugUISubscriptionCleanupSystem,
  DebugUITimelineSelectionSystem,
  DebugUIVisibilitySystem,
} from './systems.ts';

export type DebugUIOptions = {
  position?: { x: number; y: number; width: number; height: number };
  hotkeys?: DebugUIHotkey[];
  visible?: boolean;
};

export function registerDebugUISystems(world: World): void {
  world.registerSystem(DebugUIInitSystem);
  world.registerSystem(DebugUIRootStyleSystem);
  world.registerSystem(DebugUIRenderSystem);
  world.registerSystem(DebugUISelectionSystem);
  world.registerSystem(DebugUIPauseToggleSystem);
  world.registerSystem(DebugUITimelineSelectionSystem);
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

  if (!world.has(root, DebugUISelection)) {
    world.set(root, DebugUISelection({ entity: null }));
  }

  if (!world.has(root, DebugUIRenderState)) {
    world.set(root, DebugUIRenderState({ uiEntities: [] }));
  }

  if (!world.has(root, Style)) {
    world.set(root, Style({}));
  }

  return root;
}
