// @minimap summary: Defines the Style component for ECS-owned inline CSS declarations applied to DOM-backed entities.
// @minimap tags: dom style component inline css styling
/**
 * Inline style component.
 */

import { defineComponent } from '@ecs-test/ecs';

/** Inline styles for an element */
export const Style = defineComponent<Partial<CSSStyleDeclaration>>('Style');
