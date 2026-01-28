/**
 * Core ECS module - World, entities, components, systems, and bundles.
 */

// =============================================================================
// Types
// =============================================================================

/** Unique identifier for entities */
export type EntityId = number & { readonly __brand: unique symbol };

/** Component type identifier */
export type ComponentType<T = unknown> = {
  readonly _tag: string;
  (data: T): ComponentInstance<T>;
};

/** Instance of a component with data */
export type ComponentInstance<T = unknown> = {
  readonly _tag: string;
  readonly data: T;
};

/** Mutation types for reactive systems */
export type MutationType = "added" | "removed" | "replaced";

/** Recorded mutation for reactive processing */
export type Mutation = {
  entity: EntityId;
  componentTag: string;
  type: MutationType;
};

/** Trigger definition for reactive systems */
export type Trigger = {
  componentTag: string;
  mutationType: MutationType | "addedOrReplaced";
};

/** Component type or tag string - used where we need to reference a component type */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ComponentRef = ComponentType<any> | string;

/** Extract the tag string from a ComponentRef */
export function getTag(ref: ComponentRef): string {
  return typeof ref === "string" ? ref : ref._tag;
}

/** Reactive system definition */
export type ReactiveSystemDef = {
  triggers: Trigger[];
  filter?: ComponentRef[];
  execute: (entities: EntityId[], world: World) => void;
};

/** Bundle result with component instances */
export type BundleResult = {
  _isBundle: true;
  components: ComponentInstance[];
};

/** Bundle function type */
export type BundleFn<P> = (
  props: P & { except?: ComponentRef[]; only?: ComponentRef[] }
) => BundleResult;

// =============================================================================
// World
// =============================================================================

/** The ECS World - holds all entities and components */
export class World {
  private nextEntityId = 1;
  private entities = new Set<EntityId>();
  private components = new Map<EntityId, Map<string, ComponentInstance>>();
  private parents = new Map<EntityId, EntityId>();
  private childrenMap = new Map<EntityId, Set<EntityId>>();
  private mutations: Mutation[] = [];
  private systems: ReactiveSystem[] = [];

  /** Create a new entity */
  createEntity(parent?: EntityId): EntityId {
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
        this.mutations.push({ entity: id, componentTag: tag, type: "removed" });
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
    if (!entityComponents) {
      throw new Error(`Entity ${entity} does not exist`);
    }

    if (entityComponents.has(component._tag)) {
      throw new Error(
        `Component "${component._tag}" already exists on entity ${entity}. Use set() to replace.`
      );
    }

    entityComponents.set(component._tag, component);
    this.mutations.push({
      entity,
      componentTag: component._tag,
      type: "added",
    });
  }

  /**
   * Set a component on an entity (upsert).
   * Adds the component if it doesn't exist, replaces if it does.
   */
  set<T>(entity: EntityId, component: ComponentInstance<T>): void {
    const entityComponents = this.components.get(entity);
    if (!entityComponents) {
      throw new Error(`Entity ${entity} does not exist`);
    }

    const existing = entityComponents.has(component._tag);
    entityComponents.set(component._tag, component);

    this.mutations.push({
      entity,
      componentTag: component._tag,
      type: existing ? "replaced" : "added",
    });
  }

  /** Remove a component from an entity */
  remove(entity: EntityId, component: ComponentRef): void {
    const entityComponents = this.components.get(entity);
    if (!entityComponents) return;

    const componentTag = getTag(component);
    if (entityComponents.has(componentTag)) {
      entityComponents.delete(componentTag);
      this.mutations.push({ entity, componentTag, type: "removed" });
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

  /** Query entities that have all specified components */
  query(...componentTags: string[]): EntityId[] {
    const result: EntityId[] = [];
    for (const entity of this.entities) {
      const entityComponents = this.components.get(entity);
      if (entityComponents && componentTags.every((tag) => entityComponents.has(tag))) {
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

// =============================================================================
// Reactive Systems
// =============================================================================

/** Reactive system instance */
export class ReactiveSystem {
  constructor(private def: ReactiveSystemDef) {}

  matches(mutation: Mutation, world: World): boolean {
    const triggerMatches = this.def.triggers.some((trigger) => {
      if (trigger.componentTag !== mutation.componentTag) return false;
      if (trigger.mutationType === "addedOrReplaced") {
        return mutation.type === "added" || mutation.type === "replaced";
      }
      return trigger.mutationType === mutation.type;
    });

    if (!triggerMatches) return false;

    if (this.def.filter) {
      return this.def.filter.every((ref) => world.has(mutation.entity, getTag(ref)));
    }

    return true;
  }

  execute(entities: EntityId[], world: World): void {
    this.def.execute(entities, world);
  }
}

/** Define a reactive system */
export function defineReactiveSystem(def: ReactiveSystemDef): ReactiveSystem {
  return new ReactiveSystem(def);
}

// =============================================================================
// Triggers
// =============================================================================

/** Create an "added" trigger */
export const added = <T>(componentType: ComponentType<T>): Trigger => ({
  componentTag: componentType._tag,
  mutationType: "added",
});

/** Create a "removed" trigger */
export const removed = <T>(componentType: ComponentType<T>): Trigger => ({
  componentTag: componentType._tag,
  mutationType: "removed",
});

/** Create a "replaced" trigger */
export const replaced = <T>(componentType: ComponentType<T>): Trigger => ({
  componentTag: componentType._tag,
  mutationType: "replaced",
});

/** Create an "added or replaced" trigger */
export const addedOrReplaced = <T>(componentType: ComponentType<T>): Trigger => ({
  componentTag: componentType._tag,
  mutationType: "addedOrReplaced",
});

// =============================================================================
// Component Helpers
// =============================================================================

/**
 * Define a new component type.
 *
 * @example
 * const Position = defineComponent<{ x: number; y: number }>('Position');
 * const instance = Position({ x: 10, y: 20 });
 */
export function defineComponent<T>(tag: string): ComponentType<T> {
  const factory = (data: T): ComponentInstance<T> => ({
    _tag: tag,
    data,
  });
  factory._tag = tag;
  return factory as ComponentType<T>;
}

/**
 * Define a marker component (no data).
 *
 * @example
 * const Selected = defineMarker('Selected');
 * const instance = Selected();
 */
export function defineMarker(tag: string): ComponentType<void> & (() => ComponentInstance<void>) {
  const factory = (): ComponentInstance<void> => ({
    _tag: tag,
    data: undefined,
  });
  factory._tag = tag;
  return factory as ComponentType<void> & (() => ComponentInstance<void>);
}

// =============================================================================
// Bundles
// =============================================================================

/**
 * Define a bundle - a reusable group of components.
 *
 * @example
 * const RadioOption = defineBundle(({ value }: { value: string }) => [
 *   Clickable(),
 *   Value({ of: value }),
 * ]);
 *
 * // Usage with except:
 * RadioOption({ value: "a", except: ["Clickable"] })
 */
export function defineBundle<P extends Record<string, unknown>>(
  fn: (props: P) => ComponentInstance[]
): BundleFn<P> {
  return (props: P & { except?: ComponentRef[]; only?: ComponentRef[] }): BundleResult => {
    const { except, only, ...rest } = props;
    let components = fn(rest as P);

    if (only && only.length > 0) {
      const onlyTags = only.map(getTag);
      components = components.filter((c) => onlyTags.includes(c._tag));
    } else if (except && except.length > 0) {
      const exceptTags = except.map(getTag);
      components = components.filter((c) => !exceptTags.includes(c._tag));
    }

    return {
      _isBundle: true,
      components,
    };
  };
}

/** Check if a value is a bundle result */
export function isBundle(value: unknown): value is BundleResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "_isBundle" in value &&
    value._isBundle === true
  );
}
