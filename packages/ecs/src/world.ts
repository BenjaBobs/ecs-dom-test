/**
 * ECS World - the container for all entities and components.
 * @module
 */

import type { DeepReadonly } from '@ecs-test/ecs/utility-types.ts';
import { assert } from './assert.ts';
import type { ComponentInstance, ComponentRef, ComponentType } from './component.ts';
import { getTag } from './component.ts';
import { createSyncScheduler } from './scheduler.ts';
import type { Mutation, ReactiveSystem } from './system.ts';
import type { WorldExternals } from './world-externals.ts';

/**
 * Unique identifier for entities.
 * Branded type to prevent accidental use of arbitrary numbers as entity IDs.
 */
export type EntityId = number & { readonly __brand: unique symbol };

/**
 * Scheduler interface for controlling when flushes execute.
 * Implement this to customize flush timing (sync, microtask, RAF, etc.).
 */
export type FlushScheduler = {
  /**
   * Schedule a flush callback for execution.
   * May execute immediately or defer based on implementation.
   * @param callback - The flush function to execute
   * @returns Promise that resolves when the flush completes
   */
  schedule: (callback: () => void) => Promise<void>;
  /**
   * Get a promise that resolves when no work is pending.
   * @returns Promise that resolves when idle
   */
  whenIdle: () => Promise<void>;
};

/**
 * Configuration options for creating a World.
 */
export type WorldOptions = {
  /** External dependencies (e.g., createElement for DOM rendering) */
  externals?: WorldExternals;
  /** Scheduler for controlling flush timing. Defaults to sync scheduler. */
  scheduler?: FlushScheduler;
  /**
   * Automatically flush after mutations (add, set, remove, removeEntity).
   * When true, changes are immediately visible. When false, you must call flush() manually.
   * @default true
   */
  autoFlush?: boolean;
};

/**
 * The ECS World - container for all entities, components, and systems.
 *
 * The World is the central data structure in an ECS architecture.
 * It manages entity lifecycles, component storage, and reactive system execution.
 *
 * @example
 * ```typescript
 * const world = new World();
 * const entity = world.createEntity();
 * world.add(entity, Position({ x: 0, y: 0 }));
 * world.registerSystem(MovementSystem);
 * ```
 */
export class World {
  private nextEntityId = 1;
  private entities = new Set<EntityId>();
  private components = new Map<EntityId, Map<string, ComponentInstance>>();
  private componentIndex = new Map<string, Set<EntityId>>();
  private parents = new Map<EntityId, EntityId>();
  private childrenMap = new Map<EntityId, Set<EntityId>>();
  private mutations: Mutation[] = [];
  private systems: ReactiveSystem[] = [];
  private externals: WorldExternals;
  private runtimeEntityId?: EntityId;
  private scheduler: FlushScheduler;
  private autoFlush: boolean;
  private batchDepth = 0;

  /**
   * Create a new World instance.
   * @param options - Configuration options
   */
  constructor(options: WorldOptions = {}) {
    this.externals = options.externals ?? {};
    this.scheduler = options.scheduler ?? createSyncScheduler();
    this.autoFlush = options.autoFlush ?? true;
  }

  /**
   * Get the world's external dependencies.
   * @returns The externals object passed during construction
   */
  getExternals(): WorldExternals {
    return this.externals;
  }

  /**
   * Get or create the runtime entity for storing world-level state.
   * The runtime entity is a singleton used for global state like DOM element maps.
   * @returns The runtime entity ID
   */
  getRuntimeEntity(): EntityId {
    if (this.runtimeEntityId !== undefined && this.exists(this.runtimeEntityId)) {
      return this.runtimeEntityId;
    }
    const id = this.createEntity();
    this.runtimeEntityId = id;
    return id;
  }

  /**
   * Create a new entity, optionally with a parent and initial components.
   * @param parent - Optional parent entity ID. Pass null or undefined for root entities.
   * @param components - Optional array of components to add to the entity.
   * @returns The newly created entity ID.
   */
  createEntity(parent?: EntityId | null, components?: ComponentInstance[]): EntityId {
    if (parent != null) {
      assert(this.entities.has(parent), `Parent entity ${parent} does not exist`);
    }

    const id = this.nextEntityId++ as EntityId;
    this.entities.add(id);
    this.components.set(id, new Map());

    if (parent != null) {
      this.parents.set(id, parent);
      const siblings = this.childrenMap.get(parent) ?? new Set();
      siblings.add(id);
      this.childrenMap.set(parent, siblings);
    }

    if (components) {
      for (const component of components) {
        this.add(id, component);
      }
    }

    return id;
  }

  /**
   * Remove an entity and all its descendants from the world.
   * Generates 'removed' mutations for all components on removed entities.
   *
   * @param id - The entity to remove
   */
  removeEntity(id: EntityId): void {
    const children = this.childrenMap.get(id);
    if (children) {
      for (const childId of children) {
        this.removeEntity(childId);
      }
    }

    const entityComponents = this.components.get(id);
    if (entityComponents) {
      for (const [tag] of entityComponents) {
        // Update component index
        this.componentIndex.get(tag)?.delete(id);

        this.mutations.push({ entity: id, componentTag: tag, type: 'removed' });
      }
    }

    const parent = this.parents.get(id);
    if (parent !== undefined) {
      this.childrenMap.get(parent)?.delete(id);
    }

    this.entities.delete(id);
    this.components.delete(id);
    this.parents.delete(id);
    this.childrenMap.delete(id);

    if (this.autoFlush && this.batchDepth === 0) this.flush();
  }

  /**
   * Add a component to an entity.
   *
   * @typeParam T - The component's data type
   * @param entity - The entity to add the component to
   * @param component - The component instance to add
   * @throws {Error} If the entity doesn't exist
   * @throws {Error} If the component type already exists on the entity (use `set` to replace)
   */
  add<T>(entity: EntityId, component: ComponentInstance<T>): void {
    const entityComponents = this.components.get(entity);
    assert(!!entityComponents, `Entity ${entity} does not exist`);

    assert(
      !entityComponents.has(component._tag),
      `Component "${component._tag}" already exists on entity ${entity}. Use set() to replace.`,
    );

    entityComponents.set(component._tag, component);

    // Update component index
    const indexed = this.componentIndex.get(component._tag) ?? new Set();
    indexed.add(entity);
    this.componentIndex.set(component._tag, indexed);

    this.mutations.push({
      entity,
      componentTag: component._tag,
      type: 'added',
    });

    if (this.autoFlush && this.batchDepth === 0) this.flush();
  }

  /**
   * Set a component on an entity (upsert operation).
   * Adds the component if it doesn't exist, replaces the data if it does.
   *
   * @typeParam T - The component's data type
   * @param entity - The entity to set the component on
   * @param component - The component instance to set
   * @throws {Error} If the entity doesn't exist
   */
  set<T>(entity: EntityId, component: ComponentInstance<T>): void {
    const entityComponents = this.components.get(entity);
    assert(!!entityComponents, `Entity ${entity} does not exist`);

    const existing = entityComponents.has(component._tag);
    entityComponents.set(component._tag, component);

    // Update component index (only if newly added)
    if (!existing) {
      const indexed = this.componentIndex.get(component._tag) ?? new Set();
      indexed.add(entity);
      this.componentIndex.set(component._tag, indexed);
    }

    this.mutations.push({
      entity,
      componentTag: component._tag,
      type: existing ? 'replaced' : 'added',
    });

    if (this.autoFlush && this.batchDepth === 0) this.flush();
  }

  /**
   * Remove a component from an entity.
   * Does nothing if the entity doesn't exist or doesn't have the component.
   *
   * @param entity - The entity to remove the component from
   * @param component - The component type or tag to remove
   */
  remove(entity: EntityId, component: ComponentRef): void {
    const entityComponents = this.components.get(entity);
    if (!entityComponents) return;

    const componentTag = getTag(component);
    if (entityComponents.has(componentTag)) {
      entityComponents.delete(componentTag);

      // Update component index
      this.componentIndex.get(componentTag)?.delete(entity);

      this.mutations.push({ entity, componentTag, type: 'removed' });

      if (this.autoFlush && this.batchDepth === 0) this.flush();
    }
  }

  /**
   * Check if an entity has a specific component.
   *
   * @param entity - The entity to check
   * @param component - The component type or tag to look for
   * @returns True if the entity has the component
   */
  has(entity: EntityId, component: ComponentRef): boolean {
    return this.components.get(entity)?.has(getTag(component)) ?? false;
  }

  /**
   * Get a component's data from an entity.
   *
   * @typeParam T - The component's data type
   * @param entity - The entity to get the component from
   * @param componentType - The component type to retrieve
   * @returns The component data, or undefined if not present
   */
  get<T>(entity: EntityId, componentType: ComponentType<T>): DeepReadonly<T> | undefined {
    const instance = this.components.get(entity)?.get(componentType._tag);
    return instance?.data as DeepReadonly<T> | undefined;
  }

  /**
   * Get a component's data from an entity, but mutable.
   * This also automatically marks the component as replaced so it gets processed on next flush.
   * You will have to do the flush yourself though.
   *
   * @typeParam T - The component's data type
   * @param entity - The entity to get the component from
   * @param componentType - The component type to retrieve
   * @returns The component data, or undefined if not present
   */
  getMutableAndHandleFlushYourself<T>(
    entity: EntityId,
    componentType: ComponentType<T>,
  ): T | undefined {
    const instance = this.components.get(entity)?.get(componentType._tag);

    if (instance != null)
      this.mutations.push({
        componentTag: getTag(componentType),
        entity: entity,
        type: 'replaced',
      });

    return instance?.data as T | undefined;
  }

  /**
   * Get all components attached to an entity.
   *
   * @param entity - The entity to get components from
   * @returns Array of all component instances on the entity
   */
  getAll(entity: EntityId): DeepReadonly<ComponentInstance[]> {
    const entityComponents = this.components.get(entity);
    return entityComponents ? Array.from(entityComponents.values()) : [];
  }

  /**
   * Get the parent of an entity.
   *
   * @param entity - The entity to get the parent of
   * @returns The parent entity ID, or undefined if no parent
   */
  getParent(entity: EntityId): EntityId | undefined {
    return this.parents.get(entity);
  }

  /**
   * Get the children of an entity.
   *
   * @param entity - The entity to get children of
   * @returns Array of child entity IDs
   */
  getChildren(entity: EntityId): EntityId[] {
    return Array.from(this.childrenMap.get(entity) ?? []);
  }

  /**
   * Check if an entity exists in the world.
   *
   * @param entity - The entity to check
   * @returns True if the entity exists
   */
  exists(entity: EntityId): boolean {
    return this.entities.has(entity);
  }

  /**
   * Query for entities that have all specified components.
   *
   * @param componentTags - Component types or tags to filter by
   * @returns Array of entity IDs that have all specified components
   *
   * @example
   * ```typescript
   * const movable = world.query(Position, Velocity);
   * ```
   */
  query(...componentTags: ComponentRef[]): EntityId[] {
    if (componentTags.length === 0) {
      return Array.from(this.entities);
    }

    // Get the sets for each component tag
    const sets = componentTags
      .map(tag => this.componentIndex.get(getTag(tag)))
      .filter((set): set is Set<EntityId> => set !== undefined);

    // If any component has no entities, result is empty
    if (sets.length !== componentTags.length || sets.length === 0) {
      return [];
    }

    // Start with smallest set for efficiency
    sets.sort((a, b) => a.size - b.size);
    const smallest = sets[0]!;
    const rest = sets.slice(1);

    // Intersect with remaining sets
    const result: EntityId[] = [];
    for (const entity of smallest) {
      if (rest.every(set => set.has(entity))) {
        result.push(entity);
      }
    }

    return result;
  }

  /**
   * Register a reactive system with the world.
   * Systems are executed in registration order during flush.
   *
   * @param system - The reactive system to register
   */
  registerSystem(system: ReactiveSystem): void {
    this.systems.push(system);
  }

  /**
   * Batch multiple mutations into a single flush.
   * Useful when autoFlush is enabled but you need explicit batching for
   * correctness (e.g., adding multiple components that depend on each other)
   * or performance.
   *
   * Supports nesting - only the outermost batch triggers a flush.
   *
   * @typeParam T - Return type of the batch function
   * @param fn - Function containing mutations to batch
   * @returns The return value of the function
   *
   * @example
   * ```typescript
   * world.batch(() => {
   *   world.add(entity, Position({ x: 0, y: 0 }));
   *   world.add(entity, Velocity({ x: 1, y: 1 }));
   *   // Single flush happens here, not after each add
   * });
   * ```
   */
  batch<T>(fn: () => T): T {
    this.batchDepth++;
    try {
      return fn();
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0 && this.autoFlush) {
        this.flush();
      }
    }
  }

  /**
   * Process all pending mutations through reactive systems.
   * This is called automatically when autoFlush is enabled.
   *
   * @returns Promise that resolves when the flush completes
   */
  flush(): Promise<void> {
    return this.scheduler.schedule(() => {
      this.flushImpl();
    });
  }

  /**
   * Get a promise that resolves when any pending flush completes.
   * Useful for async schedulers where you need to wait for effects.
   *
   * @returns Promise that resolves when idle
   *
   * @example
   * ```typescript
   * world.add(entity, Component());
   * await world.whenFlushed();
   * // Effects are now visible
   * ```
   */
  whenFlushed(): Promise<void> {
    return this.scheduler.whenIdle();
  }

  /**
   * Internal flush implementation.
   * Processes mutations in a loop until no new mutations are generated.
   */
  private flushImpl(): void {
    while (this.mutations.length > 0) {
      const currentMutations = this.mutations;
      this.mutations = [];

      for (const system of this.systems) {
        const matchingEntities = new Set<EntityId>();

        for (const mutation of currentMutations) {
          if (system.matches(mutation, this)) {
            matchingEntities.add(mutation.entity);
          }
        }

        if (matchingEntities.size > 0) {
          system.execute(Array.from(matchingEntities), this);
        }
      }
    }
  }
}
