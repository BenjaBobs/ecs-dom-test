/**
 * Inline style component.
 */

import { defineComponent } from '@ecs-test/ecs';

/** Inline styles for an element */
export const Style = defineComponent<Partial<CSSStyleDeclaration>>('Style');
