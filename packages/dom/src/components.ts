/**
 * DOM-related components.
 */

import { defineComponent, defineMarker } from '@ecs-test/ecs';

/** Specifies the HTML element tag to render */
export const DOMElement = defineComponent<{
  tag: keyof HTMLElementTagNameMap;
}>('DOMElement');

/** Text content for an element */
export const TextContent = defineComponent<{ value: string }>('TextContent');

/** CSS classes on an element */
export const Classes = defineComponent<{ list: string[] }>('Classes');

/** Click handler marker */
export const Clickable = defineMarker('Clickable');

/** Marks an entity as clicked (transient, consumed by systems) */
export const Clicked = defineMarker('Clicked');

/** Marks an entity as disabled */
export const Disabled = defineMarker('Disabled');

/** Marks an element as draggable */
export const Draggable = defineComponent<{
  /** Data type identifier (e.g., "book", "item") */
  type: string;
  /** Data payload to transfer */
  data: unknown;
}>('Draggable');

/** Marks an element as a drop target */
export const Droppable = defineComponent<{
  /** Accepted data types */
  accepts: string[];
}>('Droppable');

/** Added when dragging over a valid drop target */
export const DragOver = defineMarker('DragOver');

/** Added when something is dropped on a Droppable entity */
export const Dropped = defineComponent<{
  /** The type of data dropped */
  type: string;
  /** The data payload */
  data: unknown;
  /** Source entity if available */
  sourceEntity?: number;
}>('Dropped');

export type DragHandlers = {
  dragstart: (e: DragEvent) => void;
  dragend: (e: DragEvent) => void;
};

export type DropHandlers = {
  dragover: (e: DragEvent) => void;
  dragleave: (e: DragEvent) => void;
  drop: (e: DragEvent) => void;
};

export type DragState = {
  entity: number;
  type: string;
  data: unknown;
};

/** Runtime state for the DOM rendering layer */
export const DomRuntime = defineComponent<{
  elements: Map<number, Element>;
  clickHandlers: Map<number, () => void>;
  dragHandlers: Map<number, DragHandlers>;
  dropHandlers: Map<number, DropHandlers>;
  dragState: DragState | null;
  /** Optional root container for auto-mounting root entities */
  rootContainer?: Element;
}>('DomRuntime');
