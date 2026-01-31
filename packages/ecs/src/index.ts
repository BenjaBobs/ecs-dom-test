/**
 * @ecs-test/ecs - Core ECS engine
 *
 * Pure Entity Component System primitives for building UI frameworks.
 */

// Component
export {
  type ComponentType,
  type ComponentInstance,
  type ComponentRef,
  getTag,
  defineComponent,
  defineMarker,
} from './component.ts';

// World
export { type EntityId, World } from './world.ts';

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
} from './system.ts';

// Bundle
export {
  type BundleResult,
  type BundleFn,
  defineBundle,
  isBundle,
} from './bundle.ts';

// JSX
export {
  Entity,
  Fragment,
  isJSXEntity,
  type JSXChild,
  type JSXEntity,
} from './jsx-runtime.ts';

// Materialization
export { materialize } from './materialize.ts';

// Assertions
export { assert } from './assert.ts';
