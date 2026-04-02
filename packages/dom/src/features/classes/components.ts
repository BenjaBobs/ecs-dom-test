// @minimap summary: Defines the Classes component used as the single source of truth for CSS class lists on DOM-backed entities.
// @minimap tags: dom classes component css className styling
/**
 * CSS class components.
 */

import { defineComponent } from '@ecs-test/ecs';

/** CSS classes on an element */
export const Classes = defineComponent<{ list: string[] }>('Classes');
