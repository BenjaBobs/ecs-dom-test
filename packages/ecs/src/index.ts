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
// Debug
export {
  Debug,
  type DebugBuffer,
  DebugChildren,
  type DebugLogEntry,
  type DebugOptions,
  type DebugOutput,
  type DebugSystemHandle,
  type DebugSystemOptions,
  registerDebugSystems,
} from './debug.ts';
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
// Scheduler
export {
  createMicrotaskScheduler,
  createRafScheduler,
  createSyncScheduler,
  type RafLike,
} from './scheduler.ts';
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
  type SystemInfo,
  type Trigger,
} from './system.ts';
// World
export {
  type EntityId,
  type EntitySnapshot,
  type FlushProfile,
  type FlushScheduler,
  type MutationCallback,
  type MutationEvent,
  type MutationSubscriptionOptions,
  type ProfilingStats,
  type SystemExecutionProfile,
  type SystemProfilingStats,
  World,
  type WorldOptions,
  type WorldSnapshot,
} from './world.ts';
export type { WorldExternals } from './world-externals.ts';
