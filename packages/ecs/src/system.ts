/**
 * Reactive system definitions for responding to component changes.
 * @module
 */

import type { ComponentRef } from './component.ts';
import { getTag } from './component.ts';
import type { EntityId, World } from './world.ts';

/**
 * Types of mutations recorded during a flush.
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

export type QueryDef = {
  /** Component tags that must be present */
  required: string[];
  /** Component tags that must be absent */
  excluded: string[];
};

export type QueryBuilder = QueryDef & {
  /** Include component types in the query */
  with: (refs: ComponentRef[]) => QueryBuilder;
  /** Exclude component types from the query */
  without: (refs: ComponentRef[]) => QueryBuilder;
};

/**
 * Configuration for defining a reactive system.
 */
export type ReactiveSystemDef = {
  /**
   * Optional name for debugging and profiling.
   * Appears in error messages, performance profiles, and world snapshots.
   */
  name?: string;
  /** Query for matching entities */
  query: QueryBuilder;
  /** Called when an entity enters the query */
  onEnter?: (world: World, entities: EntityId[]) => void;
  /** Called when a matching entity updates required components */
  onUpdate?: (world: World, entities: EntityId[]) => void;
  /** Called when an entity exits the query */
  onExit?: (world: World, entities: EntityId[]) => void;
};

/**
 * Information about a reactive system for debugging.
 */
export type SystemInfo = {
  name: string | undefined;
  required: string[];
  excluded: string[];
};

/**
 * A reactive system that responds to component mutations.
 *
 * Systems are registered with a World and automatically execute
 * when their query conditions are met during a flush.
 */
export class ReactiveSystem {
  /** Optional name for debugging and profiling */
  readonly name: string | undefined;
  readonly query: QueryDef;
  readonly onEnter?: (world: World, entities: EntityId[]) => void;
  readonly onUpdate?: (world: World, entities: EntityId[]) => void;
  readonly onExit?: (world: World, entities: EntityId[]) => void;
  readonly queryKey: string;

  constructor(def: ReactiveSystemDef) {
    this.name = def.name;
    this.query = def.query;
    this.onEnter = def.onEnter;
    this.onUpdate = def.onUpdate;
    this.onExit = def.onExit;
    this.queryKey = buildQueryKey(this.query.required, this.query.excluded);
  }

  /**
   * Check if an entity matches this system's query.
   *
   * @param mutation - The mutation to check
   * @param world - The world containing the entity
   * @returns True if this system should execute for this mutation
   */
  matchesEntity(world: World, entity: EntityId): boolean {
    for (const tag of this.query.required) {
      if (!world.has(entity, tag)) return false;
    }
    for (const tag of this.query.excluded) {
      if (world.has(entity, tag)) return false;
    }
    return true;
  }

  /**
   * Get information about this system for debugging.
   *
   * @returns System info object with name and query
   */
  getInfo(): SystemInfo {
    return {
      name: this.name,
      required: this.query.required,
      excluded: this.query.excluded,
    };
  }
}

/**
 * Define a reactive system that responds to component mutations.
 *
 * @param def - System definition with query and reactive callbacks
 * @returns A ReactiveSystem instance to register with a World
 *
 * @example
 * ```typescript
 * const MovementSystem = defineReactiveSystem({
 *   query: Entities.with([Position, Velocity]),
 *   onUpdate(world, entities) {
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
// Query Helpers
// =============================================================================

function normalizeRefs(refs: ComponentRef[]): string[] {
  const tags = refs.map(ref => getTag(ref));
  const unique = Array.from(new Set(tags));
  unique.sort();
  return unique;
}

function buildQuery(required: ComponentRef[], excluded: ComponentRef[]): QueryBuilder {
  const requiredTags = normalizeRefs(required);
  const excludedTags = normalizeRefs(excluded);
  return {
    required: requiredTags,
    excluded: excludedTags,
    with: (refs: ComponentRef[]) => buildQuery([...required, ...refs], excluded),
    without: (refs: ComponentRef[]) => buildQuery(required, [...excluded, ...refs]),
  };
}

export const Entities = {
  with(refs: ComponentRef[]): QueryBuilder {
    return buildQuery(refs, []);
  },
  without(refs: ComponentRef[]): QueryBuilder {
    return buildQuery([], refs);
  },
};

export function buildQueryKey(required: string[], excluded: string[]): string {
  return `r:${required.join('|')}|e:${excluded.join('|')}`;
}
