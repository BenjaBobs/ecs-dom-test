// @minimap summary: Re-exports the public @ecs-test/ecs API surface, including world, systems, components, bundles, events, schedulers, and JSX helpers.
// @minimap tags: ecs index exports api world systems components jsx
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
// Entity Name
export { EntityName, type EntityNameData, getEntityName } from './entity-name.ts';
// Events
export {
  defineEvent,
  type EventInstance,
  type EventRef,
  type EventType,
  getEventTag,
} from './event.ts';
// JSX
export {
  Entity,
  Fragment,
  isJSXEntity,
  type JSXChild,
  type JSXEntity,
  jsx,
  jsxDEV,
  jsxs,
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
  defineReactiveSystem,
  Entities,
  type Mutation,
  type MutationType,
  type QueryBuilder,
  type QueryDef,
  ReactiveSystem,
  type ReactiveSystemDef,
  type SystemInfo,
} from './system.ts';
// World
export {
  type EntityId,
  type EntitySnapshot,
  type EventHandler,
  type FlushProfile,
  type FlushProfileCallback,
  type FlushScheduler,
  type MutationCallback,
  type MutationEvent,
  type MutationSubscriptionOptions,
  type ProfilingStats,
  type SystemExecutionProfile,
  type SystemProfilingStats,
  World,
  type WorldEvent,
  type WorldOptions,
  type WorldSnapshot,
} from './world.ts';
export type { WorldExternals } from './world-externals.ts';
