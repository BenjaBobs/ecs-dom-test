/**
 * Text content components.
 */

import { defineComponent } from '@ecs-test/ecs';

/** Text content for an element */
export const TextContent = defineComponent<{ value: string }>('TextContent');
