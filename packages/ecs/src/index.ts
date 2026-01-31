/**
 * @ecs-test/ecs - Core ECS engine
 *
 * Pure Entity Component System primitives for building UI frameworks.
 */

// Assertions
export { assert } from './assert.ts';
// Bundle
export {
  type BundleFn,
  type BundleResult,
  defineBundle,
  isBundle,
} from './bundle.ts';
// Component
export {
  type ComponentInstance,
  type ComponentRef,
  type ComponentType,
  defineComponent,
  defineMarker,
  getTag,
} from './component.ts';
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
// System
export {
  added,
  addedOrReplaced,
  defineReactiveSystem,
  type Mutation,
  type MutationType,
  ReactiveSystem,
  type ReactiveSystemDef,
  removed,
  replaced,
  type Trigger,
} from './system.ts';
// World
export { type EntityId, World } from './world.ts';
