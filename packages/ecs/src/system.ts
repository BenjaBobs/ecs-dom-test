/**
 * Reactive system definitions.
 */

import type { EntityId } from "./world.ts";
import type { World } from "./world.ts";
import type { ComponentType, ComponentRef } from "./component.ts";
import { getTag } from "./component.ts";

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

/** Reactive system definition */
export type ReactiveSystemDef = {
  triggers: Trigger[];
  filter?: ComponentRef[];
  execute: (entities: EntityId[], world: World) => void;
};

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
      return this.def.filter.every((ref) =>
        world.has(mutation.entity, getTag(ref))
      );
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
// Trigger Helpers
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
