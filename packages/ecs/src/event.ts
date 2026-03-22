/**
 * Event definitions and helpers for ECS entity messaging.
 * @module
 */

import type { DeepReadonly } from '@ecs-test/ecs/utility-types.ts';
import { assert } from './assert.ts';

type EventFactory<T> = undefined extends T
  ? (payload?: T) => EventInstance<T>
  : (payload: T) => EventInstance<T>;

/**
 * A typed event definition/factory.
 *
 * @typeParam T - Payload type carried by the event
 */
export type EventType<T = unknown> = EventFactory<T> & {
  /** Unique identifier for this event type */
  readonly _tag: string;
};

/**
 * An emitted event instance.
 *
 * @typeParam T - Payload type carried by the event
 */
export type EventInstance<T = unknown> = {
  /** Tag identifying the event type */
  readonly _tag: string;
  /** Event payload */
  readonly payload: T;
};

/**
 * Reference to an event type by definition or tag string.
 */
// biome-ignore lint/suspicious/noExplicitAny: we only care about event tags for lookup.
export type EventRef = EventType<any> | string;

/**
 * Extract the event tag string from an EventRef.
 *
 * @param ref - Event type or tag string
 * @returns The tag string identifying the event type
 */
export function getEventTag(ref: EventRef): string {
  return typeof ref === 'string' ? ref : ref._tag;
}

/**
 * Define a new typed event.
 *
 * @typeParam T - Payload type carried by the event
 * @param tag - Unique identifier for this event type
 * @returns A factory function for creating event instances
 *
 * @example
 * ```typescript
 * const TodoToggle = defineEvent<{ todoId: number }>('todo.toggle');
 * world.emit(source, TodoToggle({ todoId: 42 }));
 * ```
 */
export function defineEvent<T>(tag: string): EventType<T> {
  assert(tag.trim().length > 0, 'Event tag must be a non-empty string');
  const factory = Object.assign(
    (payload?: T | DeepReadonly<T>): EventInstance<T> => ({
      _tag: tag,
      payload: payload as T,
    }),
    { _tag: tag },
  ) as EventFactory<T>;
  return factory as EventType<T>;
}
