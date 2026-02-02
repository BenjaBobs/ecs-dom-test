/**
 * Reactive system definitions for responding to component changes.
 * @module
 */

import type { ComponentRef, ComponentType } from './component.ts';
import { getTag } from './component.ts';
import type { EntityId, World } from './world.ts';

/**
 * Types of mutations that can trigger reactive systems.
 * - `added`: Component was added to an entity
 * - `removed`: Component was removed from an entity
 * - `replaced`: Component data was replaced (via `world.set()`)
 */
export type MutationType = 'added' | 'removed' | 'replaced';

/**
 * A recorded mutation event for reactive processing.
 */
export type Mutation = {
  /** The entity that was mutated */
  entity: EntityId;
  /** Tag of the component that changed */
  componentTag: string;
  /** Type of mutation that occurred */
  type: MutationType;
};

/**
 * Defines what mutations trigger a reactive system.
 */
export type Trigger = {
  /** Tag of the component to watch */
  componentTag: string;
  /** Type of mutation to respond to */
  mutationType: MutationType | 'addedOrReplaced';
};

/**
 * Configuration for defining a reactive system.
 */
export type ReactiveSystemDef = {
  /** Mutations that trigger this system */
  triggers: Trigger[];
  /**
   * Optional filter - entity must have all these components for the system to execute.
   * Checked at flush time, not mutation time.
   */
  filter?: ComponentRef[];
  /** Function to execute when triggered */
  execute: (entities: EntityId[], world: World) => void;
};

/**
 * A reactive system that responds to component mutations.
 *
 * Systems are registered with a World and automatically execute
 * when their trigger conditions are met during a flush.
 */
export class ReactiveSystem {
  constructor(private def: ReactiveSystemDef) {}

  /**
   * Check if a mutation matches this system's triggers and filters.
   *
   * @param mutation - The mutation to check
   * @param world - The world containing the entity
   * @returns True if this system should execute for this mutation
   */
  matches(mutation: Mutation, world: World): boolean {
    const triggerMatches = this.def.triggers.some(trigger => {
      if (trigger.componentTag !== mutation.componentTag) return false;
      if (trigger.mutationType === 'addedOrReplaced') {
        return mutation.type === 'added' || mutation.type === 'replaced';
      }
      return trigger.mutationType === mutation.type;
    });

    if (!triggerMatches) return false;

    if (this.def.filter) {
      return this.def.filter.every(ref => world.has(mutation.entity, getTag(ref)));
    }

    return true;
  }

  /**
   * Execute this system for the given entities.
   *
   * @param entities - Entities that matched the triggers
   * @param world - The world containing the entities
   */
  execute(entities: EntityId[], world: World): void {
    this.def.execute(entities, world);
  }
}

/**
 * Define a reactive system that responds to component mutations.
 *
 * @param def - System definition with triggers, optional filter, and execute function
 * @returns A ReactiveSystem instance to register with a World
 *
 * @example
 * ```typescript
 * const MovementSystem = defineReactiveSystem({
 *   triggers: [addedOrReplaced(Velocity)],
 *   filter: [Position],
 *   execute(entities, world) {
 *     for (const entity of entities) {
 *       const pos = world.get(entity, Position);
 *       const vel = world.get(entity, Velocity);
 *       world.set(entity, Position({ x: pos.x + vel.x, y: pos.y + vel.y }));
 *     }
 *   },
 * });
 * ```
 */
export function defineReactiveSystem(def: ReactiveSystemDef): ReactiveSystem {
  return new ReactiveSystem(def);
}

// =============================================================================
// Trigger Helpers
// =============================================================================

/**
 * Create a trigger that fires when a component is added to an entity.
 *
 * @typeParam T - The component's data type
 * @param componentType - The component type to watch
 * @returns A Trigger for the 'added' mutation
 *
 * @example
 * ```typescript
 * defineReactiveSystem({
 *   triggers: [added(Position)],
 *   execute(entities) { ... }
 * });
 * ```
 */
export const added = <T>(componentType: ComponentType<T>): Trigger => ({
  componentTag: componentType._tag,
  mutationType: 'added',
});

/**
 * Create a trigger that fires when a component is removed from an entity.
 *
 * @typeParam T - The component's data type
 * @param componentType - The component type to watch
 * @returns A Trigger for the 'removed' mutation
 *
 * @example
 * ```typescript
 * defineReactiveSystem({
 *   triggers: [removed(Position)],
 *   execute(entities) { ... }
 * });
 * ```
 */
export const removed = <T>(componentType: ComponentType<T>): Trigger => ({
  componentTag: componentType._tag,
  mutationType: 'removed',
});

/**
 * Create a trigger that fires when a component's data is replaced.
 * Note: Only fires on `world.set()` when the component already exists.
 *
 * @typeParam T - The component's data type
 * @param componentType - The component type to watch
 * @returns A Trigger for the 'replaced' mutation
 *
 * @example
 * ```typescript
 * defineReactiveSystem({
 *   triggers: [replaced(Position)],
 *   execute(entities) { ... }
 * });
 * ```
 */
export const replaced = <T>(componentType: ComponentType<T>): Trigger => ({
  componentTag: componentType._tag,
  mutationType: 'replaced',
});

/**
 * Create a trigger that fires when a component is added OR replaced.
 * This is the most common trigger for reactive rendering systems.
 *
 * @typeParam T - The component's data type
 * @param componentType - The component type to watch
 * @returns A Trigger for both 'added' and 'replaced' mutations
 *
 * @example
 * ```typescript
 * defineReactiveSystem({
 *   triggers: [addedOrReplaced(Position)],
 *   execute(entities) { ... }
 * });
 * ```
 */
export const addedOrReplaced = <T>(componentType: ComponentType<T>): Trigger => ({
  componentTag: componentType._tag,
  mutationType: 'addedOrReplaced',
});
