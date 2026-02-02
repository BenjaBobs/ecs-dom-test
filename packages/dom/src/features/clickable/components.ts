/**
 * Click interaction components.
 */

import { defineComponent, defineMarker } from '@ecs-test/ecs';

/** Click handler marker */
export const Clickable = defineMarker('Clickable');

/** Marks an entity as clicked (transient, consumed by systems) */
export const Clicked = defineMarker('Clicked');

export const ClickHandlers = defineComponent<{ handlers: Map<number, () => void> }>(
  'ClickHandlers',
);
