/**
 * CSS class components.
 */

import { defineComponent } from '@ecs-test/ecs';

/** CSS classes on an element */
export const Classes = defineComponent<{ list: string[] }>('Classes');
