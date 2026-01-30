/**
 * Core ECS module.
 */

// Component
export {
  type ComponentType,
  type ComponentInstance,
  type ComponentRef,
  getTag,
  defineComponent,
  defineMarker,
} from "./component.ts";

// World
export { type EntityId, World } from "./world.ts";

// System
export {
  type MutationType,
  type Mutation,
  type Trigger,
  type ReactiveSystemDef,
  ReactiveSystem,
  defineReactiveSystem,
  added,
  removed,
  replaced,
  addedOrReplaced,
} from "./system.ts";

// Bundle
export {
  type BundleResult,
  type BundleFn,
  defineBundle,
  isBundle,
} from "./bundle.ts";
