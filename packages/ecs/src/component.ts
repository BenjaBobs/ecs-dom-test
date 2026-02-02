/**
 * Component definitions and helpers for the ECS system.
 * @module
 */

import type { DeepReadonly } from '@ecs-test/ecs/utility-types.ts';
import { assert } from './assert.ts';

/**
 * A component type - a factory function that creates component instances.
 *
 * @typeParam T - The data type stored in this component
 *
 * @example
 * ```typescript
 * const Position: ComponentType<{ x: number; y: number }> = defineComponent('Position');
 * ```
 */
export type ComponentType<T = unknown> = {
  /** Unique identifier for this component type */
  readonly _tag: string;
  /** Create a new instance of this component with the given data */
  (data: T): ComponentInstance<T>;
};

/**
 * An instance of a component attached to an entity.
 *
 * @typeParam T - The data type stored in this component
 */
export type ComponentInstance<T = unknown> = {
  /** Tag identifying the component type */
  readonly _tag: string;
  /** The component's data payload */
  readonly data: T;
};

/**
 * Reference to a component type - either the type itself or its tag string.
 * Used for queries and component removal where the data type isn't needed.
 */
// biome-ignore lint/suspicious/noExplicitAny: having any here allows us to query for component types without specifying their data type, and we only use the tag anyway.
export type ComponentRef = ComponentType<any> | string;

/**
 * Extract the tag string from a ComponentRef.
 *
 * @param ref - A component type or tag string
 * @returns The tag string identifying the component type
 *
 * @example
 * ```typescript
 * getTag(Position) // => 'Position'
 * getTag('Position') // => 'Position'
 * ```
 */
export function getTag(ref: ComponentRef): string {
  return typeof ref === 'string' ? ref : ref._tag;
}

/**
 * Define a new component type with associated data.
 *
 * @typeParam T - The data type stored in this component
 * @param tag - Unique identifier for this component type
 * @returns A factory function for creating component instances
 * @throws {Error} If tag is empty or whitespace-only
 *
 * @example
 * ```typescript
 * const Position = defineComponent<{ x: number; y: number }>('Position');
 * const instance = Position({ x: 10, y: 20 });
 * world.add(entity, instance);
 * ```
 */
export function defineComponent<T>(tag: string): ComponentType<T> {
  assert(tag.trim().length > 0, 'Component tag must be a non-empty string');
  const factory = (data: T | DeepReadonly<T>): ComponentInstance<T> => ({
    _tag: tag,
    data: data as T,
  });
  factory._tag = tag;
  return factory as ComponentType<T>;
}

/**
 * Define a marker component (a component with no data, used as a flag).
 *
 * @param tag - Unique identifier for this component type
 * @returns A factory function for creating marker instances
 * @throws {Error} If tag is empty or whitespace-only
 *
 * @example
 * ```typescript
 * const Selected = defineMarker('Selected');
 * world.add(entity, Selected());
 * if (world.has(entity, Selected)) { ... }
 * ```
 */
export function defineMarker(tag: string): ComponentType<void> & (() => ComponentInstance<void>) {
  assert(tag.trim().length > 0, 'Component tag must be a non-empty string');
  const factory = (): ComponentInstance<void> => {
    return {
      _tag: tag,
      data: undefined,
    };
  };
  factory._tag = tag;
  return factory as ComponentType<void> & (() => ComponentInstance<void>);
}
