/**
 * ECS World - the container for all entities and components.
 */

import { assert } from './assert.ts';
import type { ComponentInstance, ComponentRef, ComponentType } from './component.ts';
import { getTag } from './component.ts';
import type { Mutation, ReactiveSystem } from './system.ts';

/** Unique identifier for entities */
export type EntityId = number & { readonly __brand: unique symbol };

/** The ECS World - holds all entities and components */
export class World {
  private nextEntityId = 1;
  private entities = new Set<EntityId>();
  private components = new Map<EntityId, Map<string, ComponentInstance>>();
  private componentIndex = new Map<string, Set<EntityId>>();
  private parents = new Map<EntityId, EntityId>();
  private childrenMap = new Map<EntityId, Set<EntityId>>();
  private mutations: Mutation[] = [];
  private systems: ReactiveSystem[] = [];

  /** Create a new entity */
  createEntity(parent?: EntityId): EntityId {
    if (parent !== undefined) {
      assert(this.entities.has(parent), `Parent entity ${parent} does not exist`);
    }

    const id = this.nextEntityId++ as EntityId;
    this.entities.add(id);
    this.components.set(id, new Map());

    if (parent !== undefined) {
      this.parents.set(id, parent);
      const siblings = this.childrenMap.get(parent) ?? new Set();
      siblings.add(id);
      this.childrenMap.set(parent, siblings);
    }

    return id;
  }

  /** Remove an entity and all its children */
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
  }

  /**
   * Add a component to an entity.
   * Throws if the component type already exists on the entity.
   * Use `set` for intentional replacement.
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
  }

  /**
   * Set a component on an entity (upsert).
   * Adds the component if it doesn't exist, replaces if it does.
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
  }

  /** Remove a component from an entity */
  remove(entity: EntityId, component: ComponentRef): void {
    const entityComponents = this.components.get(entity);
    if (!entityComponents) return;

    const componentTag = getTag(component);
    if (entityComponents.has(componentTag)) {
      entityComponents.delete(componentTag);

      // Update component index
      this.componentIndex.get(componentTag)?.delete(entity);

      this.mutations.push({ entity, componentTag, type: 'removed' });
    }
  }

  /** Check if entity has a component */
  has(entity: EntityId, component: ComponentRef): boolean {
    return this.components.get(entity)?.has(getTag(component)) ?? false;
  }

  /** Get a component from an entity */
  get<T>(entity: EntityId, componentType: ComponentType<T>): T | undefined {
    const instance = this.components.get(entity)?.get(componentType._tag);
    return instance?.data as T | undefined;
  }

  /** Get all components on an entity */
  getAll(entity: EntityId): ComponentInstance[] {
    const entityComponents = this.components.get(entity);
    return entityComponents ? Array.from(entityComponents.values()) : [];
  }

  /** Get parent of an entity */
  getParent(entity: EntityId): EntityId | undefined {
    return this.parents.get(entity);
  }

  /** Get children of an entity */
  getChildren(entity: EntityId): EntityId[] {
    return Array.from(this.childrenMap.get(entity) ?? []);
  }

  /** Check if an entity exists */
  exists(entity: EntityId): boolean {
    return this.entities.has(entity);
  }

  /** Query entities that have all specified components */
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

  /** Register a reactive system */
  registerSystem(system: ReactiveSystem): void {
    this.systems.push(system);
  }

  /** Process all pending mutations through reactive systems */
  flush(): void {
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
