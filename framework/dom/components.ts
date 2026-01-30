/**
 * DOM-related components.
 */

import { defineComponent, defineMarker } from "../ecs/index.ts";

/** Specifies the HTML element tag to render */
export const DOMElement = defineComponent<{
  tag: keyof HTMLElementTagNameMap;
  class?: string;
}>("DOMElement");

/** Text content for an element */
export const TextContent = defineComponent<{ value: string }>("TextContent");

/** CSS classes on an element */
export const Classes = defineComponent<{ list: string[] }>("Classes");

/** Click handler marker */
export const Clickable = defineMarker("Clickable");

/** Marks an entity as clicked (transient, consumed by systems) */
export const Clicked = defineMarker("Clicked");

/** Marks an entity as disabled */
export const Disabled = defineMarker("Disabled");
