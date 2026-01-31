/**
 * Component definitions and helpers.
 */

import { assert } from "./assert.ts";

/** Component type identifier - a factory function with a tag */
export type ComponentType<T = unknown> = {
  readonly _tag: string;
  (data: T): ComponentInstance<T>;
};

/** Instance of a component with data */
export type ComponentInstance<T = unknown> = {
  readonly _tag: string;
  readonly data: T;
};

/** Component type or tag string - used where we need to reference a component type */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ComponentRef = ComponentType<any> | string;

/** Extract the tag string from a ComponentRef */
export function getTag(ref: ComponentRef): string {
  return typeof ref === "string" ? ref : ref._tag;
}

/**
 * Define a new component type.
 *
 * @example
 * const Position = defineComponent<{ x: number; y: number }>("Position");
 * const instance = Position({ x: 10, y: 20 });
 */
export function defineComponent<T>(tag: string): ComponentType<T> {
  assert(tag.trim().length > 0, "Component tag must be a non-empty string");
  const factory = (data: T): ComponentInstance<T> => ({
    _tag: tag,
    data,
  });
  factory._tag = tag;
  return factory as ComponentType<T>;
}

/**
 * Define a marker component (no data, just a flag).
 *
 * @example
 * const Selected = defineMarker("Selected");
 * const instance = Selected();
 */
export function defineMarker(
  tag: string
): ComponentType<void> & (() => ComponentInstance<void>) {
  assert(tag.trim().length > 0, "Component tag must be a non-empty string");
  const factory = (): ComponentInstance<void> => ({
    _tag: tag,
    data: undefined,
  });
  factory._tag = tag;
  return factory as ComponentType<void> & (() => ComponentInstance<void>);
}
