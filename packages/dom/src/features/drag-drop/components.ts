/**
 * Drag and drop components.
 */

import { defineComponent, defineMarker } from '@ecs-test/ecs';

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

export const DragDropHandlers = defineComponent<{
  dragHandlers: Map<number, DragHandlers>;
  dropHandlers: Map<number, DropHandlers>;
}>('DragDropHandlers');

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

export const DragState = defineComponent<DragState>('DragState');
