/**
 * Entity naming support.
 *
 * The EntityName component allows attaching human-readable names to entities
 * for improved debuggability. Names appear in debug UI, snapshots, and logs.
 *
 * @module
 */

import { defineComponent } from './component.ts';
import type { EntityId, World } from './world.ts';

export type EntityNameData = {
  value: string;
};

/**
 * Attaches a human-readable name to an entity.
 *
 * Names improve debuggability by making entities identifiable in debug UI,
 * snapshots, and console output. Multiple entities can share the same name.
 *
 * @example
 * ```typescript
 * world.add(entity, EntityName({ value: 'SubmitButton' }));
 * ```
 *
 * @example
 * ```tsx
 * <Entity>
 *   <EntityName value="PlayerCharacter" />
 *   <Position x={0} y={0} />
 * </Entity>
 * ```
 */
export const EntityName = defineComponent<EntityNameData>('EntityName');

/**
 * Get the name of an entity, if it has one.
 *
 * @param world - The world containing the entity
 * @param entity - The entity to get the name of
 * @returns The entity's name, or undefined if it has no EntityName component
 *
 * @example
 * ```typescript
 * const name = getEntityName(world, entity);
 * console.log(name ?? `Entity ${entity}`);
 * ```
 */
export function getEntityName(world: World, entity: EntityId): string | undefined {
  const nameComponent = world.get(entity, EntityName);
  return nameComponent?.value;
}
