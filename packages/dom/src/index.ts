/**
 * @ecs-test/dom - DOM rendering layer for ECS
 *
 * Components and systems for rendering ECS entities to the DOM.
 */

// Components
export {
  DOMElement,
  TextContent,
  Classes,
  Clickable,
  Clicked,
  Disabled,
} from "./components.ts";

// Systems
export {
  getDOMElement,
  DOMCreateSystem,
  DOMRemoveSystem,
  ClickableAddSystem,
  ClickableRemoveSystem,
  DisabledAddSystem,
  DisabledRemoveSystem,
  TextContentSystem,
  ClassesSystem,
  registerDOMSystems,
  mount,
} from "./systems.ts";
