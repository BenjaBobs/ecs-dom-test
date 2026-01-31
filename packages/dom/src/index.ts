/**
 * @ecs-test/dom - DOM rendering layer for ECS
 *
 * Components and systems for rendering ECS entities to the DOM.
 */

// Components
export {
  Classes,
  Clickable,
  Clicked,
  Disabled,
  DOMElement,
  DomRuntime,
  Draggable,
  type DragHandlers,
  DragOver,
  type DragState,
  type DropHandlers,
  Droppable,
  Dropped,
  TextContent,
} from './components.ts';

// Systems
export {
  ClassesSystem,
  ClickableAddSystem,
  ClickableRemoveSystem,
  DisabledAddSystem,
  DisabledRemoveSystem,
  DOMCreateSystem,
  DOMRemoveSystem,
  DraggableAddSystem,
  DraggableRemoveSystem,
  DragOverAddSystem,
  DragOverRemoveSystem,
  DroppableAddSystem,
  DroppableRemoveSystem,
  getDOMElement,
  mount,
  registerDOMSystems,
  TextContentSystem,
} from './systems.ts';
