/**
 * @ecs-test/dom - DOM rendering layer for ECS
 *
 * Components and systems for rendering ECS entities to the DOM.
 */

import type { World } from '@ecs-test/ecs';
import { DOMCreateSystem, DOMRemoveSystem } from './dom-element-systems.ts';
import { ClassesSystem } from './features/classes/systems.ts';
import { ClickableAddSystem, ClickableRemoveSystem } from './features/clickable/systems.ts';
import { DisabledAddSystem, DisabledRemoveSystem } from './features/disabled/systems.ts';
import {
  DraggableAddSystem,
  DraggableRemoveSystem,
  DragOverAddSystem,
  DragOverRemoveSystem,
  DroppableAddSystem,
  DroppableRemoveSystem,
} from './features/drag-drop/systems.ts';
import { StyleRemoveSystem, StyleSystem } from './features/style/systems.ts';
import { TextContentSystem } from './features/text/systems.ts';

export { DOMElement, DomRuntime } from './dom-element-components.ts';
export {
  DOMCreateSystem,
  DOMRemoveSystem,
  getDOMElement,
} from './dom-element-systems.ts';
export { Classes } from './features/classes/components.ts';
// Systems
export { ClassesSystem } from './features/classes/systems.ts';
export { Clickable, Clicked } from './features/clickable/components.ts';
export { ClickableAddSystem, ClickableRemoveSystem } from './features/clickable/systems.ts';
export {
  createDebugUI,
  DebugUIEntityRef,
  type DebugUIHotkey,
  DebugUIHotkeys,
  DebugUIPanelState,
  DebugUIPauseToggle,
  DebugUIRoot,
  DebugUISelection,
  DebugUIState,
  DebugUITimeline,
  DebugUITimelineRef,
  DebugUIVisible,
  registerDebugUISystems,
} from './features/debug-ui/index.ts';
export { Disabled } from './features/disabled/components.ts';
export { DisabledAddSystem, DisabledRemoveSystem } from './features/disabled/systems.ts';
export {
  Draggable,
  type DragHandlers,
  DragOver,
  type DragState,
  type DropHandlers,
  Droppable,
  Dropped,
} from './features/drag-drop/components.ts';
export {
  DraggableAddSystem,
  DraggableRemoveSystem,
  DragOverAddSystem,
  DragOverRemoveSystem,
  DroppableAddSystem,
  DroppableRemoveSystem,
} from './features/drag-drop/systems.ts';
export { Style } from './features/style/components.ts';
export { StyleRemoveSystem, StyleSystem } from './features/style/systems.ts';
export { TextContent } from './features/text/components.ts';
export { TextContentSystem } from './features/text/systems.ts';

/**
 * Registers all DOM systems with the world.
 */
export function registerDOMSystems(world: World): void {
  world.registerSystem(DOMCreateSystem);
  world.registerSystem(DOMRemoveSystem);
  world.registerSystem(ClickableAddSystem);
  world.registerSystem(ClickableRemoveSystem);
  world.registerSystem(DisabledAddSystem);
  world.registerSystem(DisabledRemoveSystem);
  world.registerSystem(TextContentSystem);
  world.registerSystem(ClassesSystem);
  world.registerSystem(StyleSystem);
  world.registerSystem(StyleRemoveSystem);
  world.registerSystem(DraggableAddSystem);
  world.registerSystem(DraggableRemoveSystem);
  world.registerSystem(DroppableAddSystem);
  world.registerSystem(DroppableRemoveSystem);
  world.registerSystem(DragOverAddSystem);
  world.registerSystem(DragOverRemoveSystem);
}
