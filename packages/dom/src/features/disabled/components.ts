// @minimap summary: Defines the Disabled marker used to indicate that a DOM-backed entity should behave and render as disabled.
// @minimap tags: dom disabled marker state interaction
/**
 * Disabled state components.
 */

import { defineMarker } from '@ecs-test/ecs';

/** Marks an entity as disabled */
export const Disabled = defineMarker('Disabled');
