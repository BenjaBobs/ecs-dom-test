/**
 * Click interaction components.
 */

import type { EntityId, World } from '@ecs-test/ecs';
import { defineComponent, defineMarker } from '@ecs-test/ecs';

/**
 * Handler called when a Clickable entity is clicked.
 *
 * @param world - The world the entity belongs to
 * @param entity - The entity that was clicked
 */
export type ClickHandler = (world: World, entity: EntityId) => void;

/**
 * Makes an entity clickable.
 *
 * When used without arguments, the entity receives a transient `Clicked`
 * marker on click which downstream systems can query for.
 *
 * When used with an `onClick` handler, the handler is called directly —
 * no `Clicked` marker is set and no extra system is needed.
 *
 * @example
 * ```ts
 * // Marker-based (original pattern)
 * world.add(entity, Clickable());
 *
 * // Handler-based (new pattern — no extra marker or system needed)
 * world.add(entity, Clickable({ onClick: (world, entity) => { ... } }));
 * ```
 */
export const Clickable = defineComponent<{ onClick?: ClickHandler } | undefined>('Clickable');

/** Marks an entity as clicked (transient, consumed by systems) */
export const Clicked = defineMarker('Clicked');

export const ClickHandlers = defineComponent<{ handlers: Map<number, () => void> }>(
  'ClickHandlers',
);
