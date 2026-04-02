// @minimap summary: Defines the TextContent component for plain text rendered into a DOM-backed entity.
// @minimap tags: dom text component content string render
/**
 * Text content components.
 */

import { defineComponent } from '@ecs-test/ecs';

/** Text content for an element */
export const TextContent = defineComponent<{ value: string }>('TextContent');
