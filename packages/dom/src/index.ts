/**
 * @ecs-test/dom - DOM rendering layer for ECS
 *
 * Components and systems for rendering ECS entities to the DOM.
 */

import type { World } from '@ecs-test/ecs';
import { DOMElementSystem } from './dom-element-systems.ts';
import { ClassesSystem } from './features/classes/systems.ts';
import { ClickableSystem } from './features/clickable/systems.ts';
import { DisabledSystem } from './features/disabled/systems.ts';
import { DraggableSystem, DragOverSystem, DroppableSystem } from './features/drag-drop/systems.ts';
import { StyleSystem } from './features/style/systems.ts';
import { TextContentSystem } from './features/text/systems.ts';

export { DOMElement, DomRuntime } from './dom-element-components.ts';
export {
  DOMElementSystem,
  getDOMElement,
} from './dom-element-systems.ts';
export { Classes } from './features/classes/components.ts';
// Systems
export { ClassesSystem } from './features/classes/systems.ts';
export { Clickable, Clicked } from './features/clickable/components.ts';
export { ClickableSystem } from './features/clickable/systems.ts';
export {
  createDebugUI,
  DebugUIEntityRef,
  type DebugUIHotkey,
  DebugUIHotkeys,
  DebugUIIncludeDebugToggle,
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
export { DisabledSystem } from './features/disabled/systems.ts';
export {
  Draggable,
  type DragHandlers,
  DragOver,
  type DragState,
  type DropHandlers,
  Droppable,
  Dropped,
} from './features/drag-drop/components.ts';
export { DraggableSystem, DragOverSystem, DroppableSystem } from './features/drag-drop/systems.ts';
export { Style } from './features/style/components.ts';
export { StyleSystem } from './features/style/systems.ts';
export { TextContent } from './features/text/components.ts';
export { TextContentSystem } from './features/text/systems.ts';

/**
 * Registers all DOM systems with the world.
 */
export function registerDOMSystems(world: World): void {
  world.registerSystem(DOMElementSystem);
  world.registerSystem(ClickableSystem);
  world.registerSystem(DisabledSystem);
  world.registerSystem(TextContentSystem);
  world.registerSystem(ClassesSystem);
  world.registerSystem(StyleSystem);
  world.registerSystem(DraggableSystem);
  world.registerSystem(DroppableSystem);
  world.registerSystem(DragOverSystem);
}
