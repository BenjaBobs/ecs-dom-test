/**
 * ECS UI Framework
 *
 * A UI framework inspired by Entity Component System architecture.
 */

// Core ECS
export {
  // Types
  type EntityId,
  type ComponentType,
  type ComponentInstance,
  type ComponentRef,
  type MutationType,
  type Mutation,
  type Trigger,
  type ReactiveSystemDef,
  type BundleResult,
  type BundleFn,
  // World
  World,
  // Systems
  ReactiveSystem,
  defineReactiveSystem,
  // Triggers
  added,
  removed,
  replaced,
  addedOrReplaced,
  // Components
  defineComponent,
  defineMarker,
  // Bundles
  defineBundle,
  isBundle,
  // Helpers
  getTag,
} from "./ecs/index.ts";

// DOM Layer
export {
  // Components
  DOMElement,
  TextContent,
  Classes,
  Clickable,
  Clicked,
  Disabled,
  // Systems
  registerDOMSystems,
  DOMCreateSystem,
  DOMRemoveSystem,
  TextContentSystem,
  ClassesSystem,
  // Helpers
  getDOMElement,
  mount,
} from "./dom/index.ts";

// JSX
export { Entity, Fragment, isJSXEntity, type JSXChild, type JSXEntity } from "./jsx-runtime.ts";

// Materialization
export { materialize } from "./materialize.ts";
