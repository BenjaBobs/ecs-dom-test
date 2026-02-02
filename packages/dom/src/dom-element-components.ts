/**
 * DOM element components and runtime state.
 */

import { defineComponent } from '@ecs-test/ecs';

/** Runtime state for the DOM rendering layer */
export const DomRuntime = defineComponent<Record<string, never>>('DomRuntime');

/** Specifies the HTML element tag to render */
export const DOMElement = defineComponent<{
  tag: keyof HTMLElementTagNameMap;
}>('DOMElement');

export const DOMElements = defineComponent<{ elements: Map<number, Element> }>('DOMElements');
