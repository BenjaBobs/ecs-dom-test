/**
 * Drag and drop systems.
 */

import { defineReactiveSystem, Entities, type EntityId, type World } from '@ecs-test/ecs';
import { getDOMElements } from '../../dom-element-systems.ts';
import {
  DragDropHandlers,
  Draggable,
  type DragHandlers,
  DragOver,
  DragState,
  type DropHandlers,
  Droppable,
  Dropped,
} from './components.ts';

function getDragDropHandlers(world: World) {
  const runtimeId = world.getRuntimeEntity();
  let handlers = world.get(runtimeId, DragDropHandlers);
  if (!handlers) {
    handlers = {
      dragHandlers: new Map(),
      dropHandlers: new Map(),
    };
    world.set(runtimeId, DragDropHandlers(handlers));
  }
  return handlers;
}

function getDragHandlers(world: World): Map<EntityId, DragHandlers> {
  return getDragDropHandlers(world).dragHandlers as Map<EntityId, DragHandlers>;
}

function getDropHandlers(world: World): Map<EntityId, DropHandlers> {
  return getDragDropHandlers(world).dropHandlers as Map<EntityId, DropHandlers>;
}

function getDragState(world: World): DragState | null {
  const runtimeId = world.getRuntimeEntity();
  return (world.get(runtimeId, DragState) as DragState | undefined) ?? null;
}

function setDragState(world: World, state: DragState | null): void {
  const runtimeId = world.getRuntimeEntity();
  if (state) {
    world.set(runtimeId, DragState(state));
  } else if (world.has(runtimeId, DragState)) {
    world.remove(runtimeId, DragState);
  }
}

/**
 * Sets up drag behavior when Draggable is added.
 */
export const DraggableSystem = defineReactiveSystem({
  name: 'DraggableSystem',
  query: Entities.with([Draggable]),
  onEnter(world, entities) {
    const domElements = getDOMElements(world);
    const dragHandlers = getDragHandlers(world);

    for (const entity of entities) {
      const el = domElements.get(entity) as HTMLElement;
      const draggable = world.get(entity, Draggable);
      if (!el || !draggable) continue;

      el.draggable = true;
      el.style.cursor = 'grab';

      const handlers = {
        dragstart: (e: DragEvent) => {
          setDragState(world, {
            entity,
            type: draggable.type,
            data: draggable.data,
          });
          el.style.opacity = '0.5';
          e.dataTransfer?.setData('text/plain', draggable.type);
        },
        dragend: () => {
          setDragState(world, null);
          el.style.opacity = '';
        },
      };

      el.addEventListener('dragstart', handlers.dragstart);
      el.addEventListener('dragend', handlers.dragend);
      dragHandlers.set(entity, handlers);
    }
  },
  onExit(world, entities) {
    const domElements = getDOMElements(world);
    const dragHandlers = getDragHandlers(world);

    for (const entity of entities) {
      const el = domElements.get(entity) as HTMLElement;
      const handlers = dragHandlers.get(entity);

      if (el && handlers) {
        el.removeEventListener('dragstart', handlers.dragstart);
        el.removeEventListener('dragend', handlers.dragend);
        el.draggable = false;
        el.style.cursor = '';
      }
      dragHandlers.delete(entity);
    }
  },
});

/**
 * Sets up drop behavior when Droppable is added.
 */
export const DroppableSystem = defineReactiveSystem({
  name: 'DroppableSystem',
  query: Entities.with([Droppable]),
  onEnter(world, entities) {
    const domElements = getDOMElements(world);
    const dropHandlers = getDropHandlers(world);

    for (const entity of entities) {
      const el = domElements.get(entity) as HTMLElement;
      const droppable = world.get(entity, Droppable);
      if (!el || !droppable) continue;

      const handlers = {
        dragover: (e: DragEvent) => {
          const dragState = getDragState(world);
          if (!dragState) return;

          // Check if this drop target accepts the dragged type
          if (!droppable.accepts.includes(dragState.type)) return;

          e.preventDefault();
          if (!world.has(entity, DragOver)) {
            world.add(entity, DragOver());
            world.flush();
          }
        },
        dragleave: () => {
          if (world.has(entity, DragOver)) {
            world.remove(entity, DragOver);
            world.flush();
          }
        },
        drop: (e: DragEvent) => {
          e.preventDefault();
          const dragState = getDragState(world);
          if (!dragState) return;

          // Check if this drop target accepts the dragged type
          if (!droppable.accepts.includes(dragState.type)) return;

          // Remove drag over state
          if (world.has(entity, DragOver)) {
            world.remove(entity, DragOver);
          }

          // Add dropped event
          world.set(
            entity,
            Dropped({
              type: dragState.type,
              data: dragState.data,
              sourceEntity: dragState.entity,
            }),
          );
          world.flush();
        },
      };

      el.addEventListener('dragover', handlers.dragover);
      el.addEventListener('dragleave', handlers.dragleave);
      el.addEventListener('drop', handlers.drop);
      dropHandlers.set(entity, handlers);
    }
  },
  onExit(world, entities) {
    const domElements = getDOMElements(world);
    const dropHandlers = getDropHandlers(world);

    for (const entity of entities) {
      const el = domElements.get(entity) as HTMLElement;
      const handlers = dropHandlers.get(entity);

      if (el && handlers) {
        el.removeEventListener('dragover', handlers.dragover);
        el.removeEventListener('dragleave', handlers.dragleave);
        el.removeEventListener('drop', handlers.drop);
      }
      dropHandlers.delete(entity);
    }
  },
});

/**
 * Adds visual feedback when DragOver is added.
 */
export const DragOverSystem = defineReactiveSystem({
  name: 'DragOverSystem',
  query: Entities.with([DragOver]),
  onEnter(world, entities) {
    const domElements = getDOMElements(world);

    for (const entity of entities) {
      const el = domElements.get(entity) as HTMLElement;
      if (el) {
        el.classList.add('drag-over');
      }
    }
  },
  onExit(world, entities) {
    const domElements = getDOMElements(world);

    for (const entity of entities) {
      const el = domElements.get(entity) as HTMLElement;
      if (el) {
        el.classList.remove('drag-over');
      }
    }
  },
});
