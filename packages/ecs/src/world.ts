/**
 * ECS World - the container for all entities and components.
 * @module
 */

import type { DeepReadonly } from '@ecs-test/ecs/utility-types.ts';
import { assert } from './assert.ts';
import type { ComponentInstance, ComponentRef, ComponentType } from './component.ts';
import { getTag } from './component.ts';
import { createSyncScheduler } from './scheduler.ts';
import type { Mutation, ReactiveSystem, SystemInfo } from './system.ts';
import type { WorldExternals } from './world-externals.ts';

/**
 * Unique identifier for entities.
 * Branded type to prevent accidental use of arbitrary numbers as entity IDs.
 */
export type EntityId = number & { readonly __brand: unique symbol };

/**
 * Snapshot of a single entity's state.
 * Returned by `world.inspect()`.
 */
export type EntitySnapshot = {
  /** The entity's unique identifier */
  id: EntityId;
  /** Parent entity ID, or null if root */
  parent: EntityId | null;
  /** IDs of child entities */
  children: EntityId[];
  /** Component data keyed by component tag */
  components: Record<string, unknown>;
};

/**
 * Complete snapshot of world state.
 * Returned by `world.snapshot()`.
 */
export type WorldSnapshot = {
  /** All entities in the world */
  entities: EntitySnapshot[];
  /** All registered systems */
  systems: SystemInfo[];
  /** Summary statistics */
  stats: {
    entityCount: number;
    componentCount: number;
    systemCount: number;
  };
};

/**
 * Extended mutation event with component data.
 * Passed to mutation subscribers.
 */
export type MutationEvent = {
  /** The entity that was mutated */
  entity: EntityId;
  /** Tag of the component that changed */
  componentTag: string;
  /** Type of mutation */
  type: 'added' | 'removed' | 'replaced';
  /** Component data after mutation (undefined for 'removed') */
  data: unknown | undefined;
  /** Component data before mutation (undefined for 'added') */
  previousData: unknown | undefined;
};

/**
 * Callback function for mutation subscriptions.
 */
export type MutationCallback = (event: MutationEvent) => void;

/**
 * Options for filtering mutation subscriptions.
 */
export type MutationSubscriptionOptions = {
  /** Only receive mutations for this specific entity */
  entity?: EntityId;
  /** When entity is specified, also include mutations on descendant entities */
  includeDescendants?: boolean;
  /** Only receive mutations for these component types */
  components?: ComponentRef[];
};

type MutationSubscription = {
  callback: MutationCallback;
  options?: MutationSubscriptionOptions;
  componentTags?: Set<string>;
};

export type SystemExecutionProfile = {
  name: string;
  duration: number;
  entityCount: number;
  entities?: EntityId[];
};

export type FlushProfile = {
  id: number;
  totalDuration: number;
  mutationCount: number;
  systemExecutions: SystemExecutionProfile[];
};

export type FlushProfileCallback = (profile: FlushProfile) => void;

export type SystemProfilingStats = {
  callCount: number;
  totalDuration: number;
  avgDuration: number;
  maxDuration: number;
};

export type ProfilingStats = {
  flushCount: number;
  totalDuration: number;
  avgFlushDuration: number;
  systemStats: Map<string, SystemProfilingStats>;
};

type SystemProfilingStatsInternal = {
  callCount: number;
  totalDuration: number;
  maxDuration: number;
};

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

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
  private mutationSubscribers = new Set<MutationSubscription>();
  private profilingEnabled = false;
  private lastFlushProfile: FlushProfile | null = null;
  private profilingSequence = 0;
  private profilingSubscribers = new Set<FlushProfileCallback>();
  private profilingStats = {
    flushCount: 0,
    totalDuration: 0,
    systemStats: new Map<string, SystemProfilingStatsInternal>(),
  };

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
      assert(this.entities.has(parent), `Cannot create entity with non-existent parent ${parent}`);
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
      for (const [tag, instance] of entityComponents) {
        // Update component index
        this.componentIndex.get(tag)?.delete(id);

        this.mutations.push({ entity: id, componentTag: tag, type: 'removed' });

        this.notifyMutationSubscribers(id, tag, 'removed', undefined, instance.data);
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
    assert(
      !!entityComponents,
      `Cannot add component "${component._tag}" to non-existent entity ${entity}`,
    );

    if (entityComponents.has(component._tag)) {
      const existingTags = Array.from(entityComponents.keys());
      assert(
        false,
        `Component "${component._tag}" already exists on ${this.formatEntityInfo(entity)}.\n` +
          `  Existing components: [${existingTags.join(', ')}]\n` +
          `  Use set() to replace existing components.`,
      );
    }

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

    this.notifyMutationSubscribers(entity, component._tag, 'added', component.data, undefined);

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
    assert(
      !!entityComponents,
      `Cannot set component "${component._tag}" on non-existent entity ${entity}`,
    );

    const existingInstance = entityComponents.get(component._tag);
    const previousData = existingInstance?.data;
    entityComponents.set(component._tag, component);

    // Update component index (only if newly added)
    if (!existingInstance) {
      const indexed = this.componentIndex.get(component._tag) ?? new Set();
      indexed.add(entity);
      this.componentIndex.set(component._tag, indexed);
    }

    const mutationType = existingInstance ? 'replaced' : 'added';
    this.mutations.push({
      entity,
      componentTag: component._tag,
      type: mutationType,
    });

    this.notifyMutationSubscribers(
      entity,
      component._tag,
      mutationType,
      component.data,
      previousData,
    );

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
    const existingInstance = entityComponents.get(componentTag);
    if (existingInstance) {
      const previousData = existingInstance.data;
      entityComponents.delete(componentTag);

      // Update component index
      this.componentIndex.get(componentTag)?.delete(entity);

      this.mutations.push({ entity, componentTag, type: 'removed' });

      this.notifyMutationSubscribers(entity, componentTag, 'removed', undefined, previousData);

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

  // ===========================================================================
  // Inspection API
  // ===========================================================================

  /**
   * Get all entity IDs in the world.
   *
   * @returns Array of all entity IDs
   */
  getEntities(): EntityId[] {
    return Array.from(this.entities);
  }

  /**
   * Get a snapshot of a single entity's state.
   *
   * @param entity - The entity to inspect
   * @returns Entity snapshot with components, parent, and children
   * @throws {Error} If the entity doesn't exist
   *
   * @example
   * ```typescript
   * const snapshot = world.inspect(entity);
   * console.log(snapshot.components);
   * // { DOMElement: { tag: 'div' }, Classes: { list: ['active'] } }
   * ```
   */
  inspect(entity: EntityId): EntitySnapshot {
    assert(this.entities.has(entity), `Entity ${entity} does not exist`);

    const entityComponents = this.components.get(entity)!;
    const components: Record<string, unknown> = {};

    for (const [tag, instance] of entityComponents) {
      components[tag] = instance.data;
    }

    return {
      id: entity,
      parent: this.parents.get(entity) ?? null,
      children: this.getChildren(entity),
      components,
    };
  }

  /**
   * Get information about all registered systems.
   *
   * @returns Array of system information objects
   */
  getSystems(): SystemInfo[] {
    return this.systems.map(system => system.getInfo());
  }

  /**
   * Get a complete snapshot of the world state.
   * Useful for debugging, logging, or serialization.
   *
   * @returns Full world snapshot with all entities, systems, and stats
   *
   * @example
   * ```typescript
   * const snapshot = world.snapshot();
   * console.log(JSON.stringify(snapshot, null, 2));
   * ```
   */
  snapshot(): WorldSnapshot {
    const entities = this.getEntities().map(id => this.inspect(id));

    let componentCount = 0;
    for (const entityComponents of this.components.values()) {
      componentCount += entityComponents.size;
    }

    return {
      entities,
      systems: this.getSystems(),
      stats: {
        entityCount: this.entities.size,
        componentCount,
        systemCount: this.systems.length,
      },
    };
  }

  /**
   * Print a quick summary of an entity to the console.
   *
   * @param entity - The entity to debug
   * @returns The formatted debug output
   *
   * @example
   * ```typescript
   * const world = new World({ externals: { console } });
   * world.debug(entity);
   * ```
   */
  debug(entity: EntityId): string {
    const snapshot = this.inspect(entity);
    const lines: string[] = [];

    lines.push(`Entity ${snapshot.id} (parent: ${snapshot.parent ?? 'null'})`);

    for (const [tag, data] of Object.entries(snapshot.components)) {
      const formatted = this.formatComponentData(data);
      lines.push(formatted ? `  ${tag} ${formatted}` : `  ${tag}`);
    }

    lines.push(`  Children: [${snapshot.children.join(', ')}]`);

    const output = lines.join('\n');
    this.externals.console?.log(output);
    return output;
  }

  /**
   * Print an entity tree to the console.
   *
   * @param entity - The root entity to debug
   * @returns The formatted tree output
   *
   * @example
   * ```typescript
   * const world = new World({ externals: { console } });
   * world.debugTree(entity);
   * ```
   */
  debugTree(entity: EntityId): string {
    assert(this.entities.has(entity), `Entity ${entity} does not exist`);

    const lines: string[] = [];
    const walk = (id: EntityId, prefix: string, isLast: boolean, isRoot: boolean): void => {
      const connector = isRoot ? '' : isLast ? '`- ' : '|- ';
      lines.push(`${prefix}${connector}${this.formatEntityTreeLine(id)}`);

      const children = this.getChildren(id);
      const nextPrefix = isRoot ? '' : prefix + (isLast ? '   ' : '|  ');
      for (let i = 0; i < children.length; i++) {
        walk(children[i]!, nextPrefix, i === children.length - 1, false);
      }
    };

    walk(entity, '', true, true);

    const output = lines.join('\n');
    this.externals.console?.log(output);
    return output;
  }

  // ===========================================================================
  // Mutation Tracking
  // ===========================================================================

  /**
   * Subscribe to mutation events for debugging or building dev tools.
   *
   * @param callback - Function called for each matching mutation
   * @param options - Optional filters for entity, descendants, or component types
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * // Watch all mutations
   * const unsub = world.onMutation((event) => {
   *   console.log(`${event.type}: ${event.componentTag} on entity ${event.entity}`);
   * });
   *
   * // Watch specific entity and its children
   * world.onMutation(
   *   (event) => console.log(event),
   *   { entity: formEntity, includeDescendants: true }
   * );
   *
   * // Watch specific component types
   * world.onMutation(
   *   (event) => console.log(event),
   *   { components: [Position, Velocity] }
   * );
   *
   * // Stop watching
   * unsub();
   * ```
   */
  onMutation(callback: MutationCallback, options?: MutationSubscriptionOptions): () => void {
    const componentTags =
      options?.components && options.components.length > 0
        ? new Set(options.components.map(component => getTag(component)))
        : undefined;
    const subscription: MutationSubscription = { callback, options, componentTags };
    this.mutationSubscribers.add(subscription);
    return () => {
      this.mutationSubscribers.delete(subscription);
    };
  }

  /**
   * Notify subscribers of a mutation event.
   * @internal
   */
  private notifyMutationSubscribers(
    entity: EntityId,
    componentTag: string,
    type: 'added' | 'removed' | 'replaced',
    data: unknown | undefined,
    previousData: unknown | undefined,
  ): void {
    if (this.mutationSubscribers.size === 0) return;

    const event: MutationEvent = { entity, componentTag, type, data, previousData };

    for (const subscription of this.mutationSubscribers) {
      if (this.matchesMutationFilter(event, subscription)) {
        const { callback } = subscription;
        callback(event);
      }
    }
  }

  /**
   * Check if a mutation event matches the subscription filter.
   * @internal
   */
  private matchesMutationFilter(event: MutationEvent, subscription: MutationSubscription): boolean {
    const options = subscription.options;
    if (!options) return true;

    // Filter by entity
    if (options.entity !== undefined) {
      if (options.includeDescendants) {
        if (!this.isDescendantOf(event.entity, options.entity) && event.entity !== options.entity) {
          return false;
        }
      } else if (event.entity !== options.entity) {
        return false;
      }
    }

    // Filter by component types
    if (subscription.componentTags && subscription.componentTags.size > 0) {
      if (!subscription.componentTags.has(event.componentTag)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if an entity is a descendant of another entity.
   * @internal
   */
  private isDescendantOf(entity: EntityId, ancestor: EntityId): boolean {
    let current = this.parents.get(entity);
    while (current !== undefined) {
      if (current === ancestor) return true;
      current = this.parents.get(current);
    }
    return false;
  }

  // ===========================================================================
  // Performance Profiling
  // ===========================================================================

  /**
   * Enable performance profiling for flush cycles.
   */
  enableProfiling(): void {
    this.profilingEnabled = true;
  }

  /**
   * Disable performance profiling.
   */
  disableProfiling(): void {
    this.profilingEnabled = false;
  }

  /**
   * Get timing data for the most recent flush.
   *
   * @returns The last flush profile, or null if profiling is disabled or no flush has run
   */
  getLastFlushProfile(): FlushProfile | null {
    return this.lastFlushProfile;
  }

  /**
   * Subscribe to per-flush profiling data.
   *
   * @param callback - Called after each profiled flush
   * @returns Unsubscribe function
   */
  onFlushProfile(callback: FlushProfileCallback): () => void {
    this.profilingSubscribers.add(callback);
    return () => {
      this.profilingSubscribers.delete(callback);
    };
  }

  /**
   * Get aggregate profiling stats since profiling was enabled.
   *
   * @returns Aggregate profiling stats
   */
  getProfilingStats(): ProfilingStats {
    const { flushCount, totalDuration } = this.profilingStats;
    const avgFlushDuration = flushCount > 0 ? totalDuration / flushCount : 0;

    const systemStats = new Map<string, SystemProfilingStats>();
    for (const [name, stats] of this.profilingStats.systemStats.entries()) {
      const avgDuration = stats.callCount > 0 ? stats.totalDuration / stats.callCount : 0;
      systemStats.set(name, {
        callCount: stats.callCount,
        totalDuration: stats.totalDuration,
        avgDuration,
        maxDuration: stats.maxDuration,
      });
    }

    return {
      flushCount,
      totalDuration,
      avgFlushDuration,
      systemStats,
    };
  }

  /**
   * Reset aggregate profiling stats and last flush profile.
   */
  resetProfilingStats(): void {
    this.lastFlushProfile = null;
    this.profilingStats = {
      flushCount: 0,
      totalDuration: 0,
      systemStats: new Map<string, SystemProfilingStatsInternal>(),
    };
  }

  /**
   * Update aggregate system stats with a new execution duration.
   * @internal
   */
  private updateSystemProfilingStats(name: string, duration: number): void {
    const stats = this.profilingStats.systemStats.get(name) ?? {
      callCount: 0,
      totalDuration: 0,
      maxDuration: 0,
    };

    stats.callCount += 1;
    stats.totalDuration += duration;
    if (duration > stats.maxDuration) {
      stats.maxDuration = duration;
    }

    this.profilingStats.systemStats.set(name, stats);
  }

  // ===========================================================================
  // Error Formatting Helpers
  // ===========================================================================

  /**
   * Format entity info for error messages.
   * @internal
   */
  private formatEntityInfo(entity: EntityId): string {
    const entityComponents = this.components.get(entity);
    if (!entityComponents) {
      return `Entity ${entity} (not found)`;
    }

    const componentTags = Array.from(entityComponents.keys());
    const parentChain = this.formatParentChain(entity);

    if (componentTags.length === 0) {
      return `Entity ${entity} (no components) chain: ${parentChain}`;
    }

    return `Entity ${entity} [${componentTags.join(', ')}] chain: ${parentChain}`;
  }

  /**
   * Format component data for debug output.
   * @internal
   */
  private formatComponentData(data: unknown): string {
    if (data === undefined) return '';
    try {
      return JSON.stringify(data);
    } catch {
      return String(data);
    }
  }

  /**
   * Format a line for debug tree output.
   * @internal
   */
  private formatEntityTreeLine(entity: EntityId): string {
    const tags = Array.from(this.components.get(entity)?.keys() ?? []);
    if (tags.length === 0) {
      return `Entity ${entity}`;
    }
    return `Entity ${entity} (${tags.join(', ')})`;
  }

  /**
   * Format parent chain for error messages.
   * @internal
   */
  private formatParentChain(entity: EntityId): string {
    const chain: EntityId[] = [entity];
    let current = this.parents.get(entity);
    while (current !== undefined) {
      chain.push(current);
      current = this.parents.get(current);
    }
    if (chain.length === 1) {
      return `${entity} (root)`;
    }
    return chain.join(' → ');
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
    if (!this.profilingEnabled) {
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
            const entities = Array.from(matchingEntities);
            try {
              system.execute(entities, this);
            } catch (error) {
              throw this.wrapSystemError(error, system, entities);
            }
          }
        }
      }
      return;
    }

    const start = now();
    let mutationCount = 0;
    const systemExecutions: SystemExecutionProfile[] = [];

    while (this.mutations.length > 0) {
      const currentMutations = this.mutations;
      this.mutations = [];
      mutationCount += currentMutations.length;

      for (const system of this.systems) {
        const matchingEntities = new Set<EntityId>();

        for (const mutation of currentMutations) {
          if (system.matches(mutation, this)) {
            matchingEntities.add(mutation.entity);
          }
        }

        if (matchingEntities.size > 0) {
          const entities = Array.from(matchingEntities);
          const systemStart = now();
          try {
            system.execute(entities, this);
          } catch (error) {
            const duration = now() - systemStart;
            const name = system.name ?? '(unnamed system)';
            systemExecutions.push({
              name,
              duration,
              entityCount: entities.length,
              entities,
            });
            this.updateSystemProfilingStats(name, duration);
            throw this.wrapSystemError(error, system, entities);
          }

          const duration = now() - systemStart;
          const name = system.name ?? '(unnamed system)';
          systemExecutions.push({
            name,
            duration,
            entityCount: entities.length,
            entities,
          });
          this.updateSystemProfilingStats(name, duration);
        }
      }
    }

    const totalDuration = now() - start;
    this.profilingSequence += 1;
    this.lastFlushProfile = {
      id: this.profilingSequence,
      totalDuration,
      mutationCount,
      systemExecutions,
    };
    if (this.profilingSubscribers.size > 0) {
      for (const callback of this.profilingSubscribers) {
        callback(this.lastFlushProfile);
      }
    }
    this.profilingStats.flushCount += 1;
    this.profilingStats.totalDuration += totalDuration;
  }

  /**
   * Wrap an error thrown by a system with additional context.
   * @internal
   */
  private wrapSystemError(error: unknown, system: ReactiveSystem, entities: EntityId[]): Error {
    const systemName = system.name ?? '(unnamed system)';
    const entityInfos = entities.map(e => this.formatEntityInfo(e)).join('\n    ');

    const originalMessage = error instanceof Error ? error.message : String(error);
    const originalStack = error instanceof Error ? error.stack : undefined;

    const enhancedMessage =
      `Error in system "${systemName}" while processing ${entities.length} entity(ies):\n` +
      `  Entities:\n    ${entityInfos}\n` +
      `  Original error: ${originalMessage}`;

    const enhancedError = new Error(enhancedMessage);
    if (originalStack) {
      enhancedError.stack = `${enhancedMessage}\n${originalStack.split('\n').slice(1).join('\n')}`;
    }

    return enhancedError;
  }
}
