/**
 * DOM rendering systems.
 */

import {
  type World,
  type EntityId,
  defineReactiveSystem,
  added,
  removed,
  addedOrReplaced,
} from '@ecs-test/ecs';
import {
  DOMElement,
  TextContent,
  Classes,
  Clickable,
  Clicked,
  Disabled,
  Draggable,
  Droppable,
  DragOver,
  Dropped,
} from './components.ts';

/** Per-world DOM element storage */
const worldDOMElements = new WeakMap<World, Map<EntityId, Element>>();

/** Per-world click handler storage */
const worldClickHandlers = new WeakMap<World, Map<EntityId, () => void>>();

/** Per-world drag handler storage */
type DragHandlers = {
  dragstart: (e: DragEvent) => void;
  dragend: (e: DragEvent) => void;
};
const worldDragHandlers = new WeakMap<World, Map<EntityId, DragHandlers>>();

/** Per-world drop handler storage */
type DropHandlers = {
  dragover: (e: DragEvent) => void;
  dragleave: (e: DragEvent) => void;
  drop: (e: DragEvent) => void;
};
const worldDropHandlers = new WeakMap<World, Map<EntityId, DropHandlers>>();

/** Current drag state per world */
type DragState = {
  entity: EntityId;
  type: string;
  data: unknown;
};
const worldDragState = new WeakMap<World, DragState | null>();

/** Get or create the DOM elements map for a world */
function getDOMElements(world: World): Map<EntityId, Element> {
  let map = worldDOMElements.get(world);
  if (!map) {
    map = new Map();
    worldDOMElements.set(world, map);
  }
  return map;
}

/** Get or create the click handlers map for a world */
function getClickHandlers(world: World): Map<EntityId, () => void> {
  let map = worldClickHandlers.get(world);
  if (!map) {
    map = new Map();
    worldClickHandlers.set(world, map);
  }
  return map;
}

/** Get or create the drag handlers map for a world */
function getDragHandlers(world: World): Map<EntityId, DragHandlers> {
  let map = worldDragHandlers.get(world);
  if (!map) {
    map = new Map();
    worldDragHandlers.set(world, map);
  }
  return map;
}

/** Get or create the drop handlers map for a world */
function getDropHandlers(world: World): Map<EntityId, DropHandlers> {
  let map = worldDropHandlers.get(world);
  if (!map) {
    map = new Map();
    worldDropHandlers.set(world, map);
  }
  return map;
}

/** Get the DOM element for an entity in a world */
export function getDOMElement(world: World, entity: EntityId): Element | undefined {
  return getDOMElements(world).get(entity);
}

/**
 * Creates DOM elements when DOMElement component is added.
 * Only creates the node - other systems handle behavior.
 */
export const DOMCreateSystem = defineReactiveSystem({
  triggers: [added(DOMElement)],
  execute(entities, world) {
    const domElements = getDOMElements(world);

    for (const entity of entities) {
      const spec = world.get(entity, DOMElement);
      if (!spec) continue;

      const el = document.createElement(spec.tag);
      domElements.set(entity, el);

      // Attach to parent's DOM element
      const parentId = world.getParent(entity);
      if (parentId !== undefined) {
        const parentEl = domElements.get(parentId);
        if (parentEl) {
          parentEl.appendChild(el);
        }
      }
    }
  },
});

/**
 * Removes DOM elements when entity is removed.
 */
export const DOMRemoveSystem = defineReactiveSystem({
  triggers: [removed(DOMElement)],
  execute(entities, world) {
    const domElements = getDOMElements(world);
    const clickHandlers = getClickHandlers(world);

    for (const entity of entities) {
      const el = domElements.get(entity);
      if (el) {
        el.remove();
        domElements.delete(entity);
      }
      clickHandlers.delete(entity);
    }
  },
});

/**
 * Attaches click handler when Clickable is added.
 */
export const ClickableAddSystem = defineReactiveSystem({
  triggers: [added(Clickable)],
  execute(entities, world) {
    const domElements = getDOMElements(world);
    const clickHandlers = getClickHandlers(world);

    for (const entity of entities) {
      const el = domElements.get(entity);
      if (!el) continue;

      // Remove existing handler if any
      const existingHandler = clickHandlers.get(entity);
      if (existingHandler) {
        el.removeEventListener('click', existingHandler);
      }

      const handler = () => {
        if (!world.has(entity, Disabled)) {
          world.set(entity, Clicked());
          world.flush();
        }
      };

      el.addEventListener('click', handler);
      clickHandlers.set(entity, handler);
      (el as HTMLElement).style.cursor = 'pointer';
    }
  },
});

/**
 * Removes click handler when Clickable is removed.
 */
export const ClickableRemoveSystem = defineReactiveSystem({
  triggers: [removed(Clickable)],
  execute(entities, world) {
    const domElements = getDOMElements(world);
    const clickHandlers = getClickHandlers(world);

    for (const entity of entities) {
      const el = domElements.get(entity);
      const handler = clickHandlers.get(entity);

      if (el && handler) {
        el.removeEventListener('click', handler);
        (el as HTMLElement).style.cursor = '';
      }
      clickHandlers.delete(entity);
    }
  },
});

/**
 * Adds disabled class when Disabled is added.
 */
export const DisabledAddSystem = defineReactiveSystem({
  triggers: [added(Disabled)],
  execute(entities, world) {
    const domElements = getDOMElements(world);

    for (const entity of entities) {
      const el = domElements.get(entity);
      if (el) {
        el.classList.add('disabled');
      }
    }
  },
});

/**
 * Removes disabled class when Disabled is removed.
 */
export const DisabledRemoveSystem = defineReactiveSystem({
  triggers: [removed(Disabled)],
  execute(entities, world) {
    const domElements = getDOMElements(world);

    for (const entity of entities) {
      const el = domElements.get(entity);
      if (el) {
        el.classList.remove('disabled');
      }
    }
  },
});

/**
 * Updates text content when TextContent changes.
 */
export const TextContentSystem = defineReactiveSystem({
  triggers: [addedOrReplaced(TextContent)],
  execute(entities, world) {
    const domElements = getDOMElements(world);

    for (const entity of entities) {
      const el = domElements.get(entity);
      const text = world.get(entity, TextContent);
      if (el && text) {
        el.textContent = text.value;
      }
    }
  },
});

/**
 * Updates classes when Classes component changes.
 */
export const ClassesSystem = defineReactiveSystem({
  triggers: [addedOrReplaced(Classes)],
  execute(entities, world) {
    const domElements = getDOMElements(world);

    for (const entity of entities) {
      const el = domElements.get(entity);
      const classes = world.get(entity, Classes);
      if (el && classes) {
        el.className = classes.list.join(' ');
      }
    }
  },
});

/**
 * Sets up drag behavior when Draggable is added.
 */
export const DraggableAddSystem = defineReactiveSystem({
  triggers: [added(Draggable)],
  execute(entities, world) {
    const domElements = getDOMElements(world);
    const dragHandlers = getDragHandlers(world);

    for (const entity of entities) {
      const el = domElements.get(entity) as HTMLElement;
      const draggable = world.get(entity, Draggable);
      if (!el || !draggable) continue;

      el.draggable = true;
      el.style.cursor = 'grab';

      const handlers: DragHandlers = {
        dragstart: (e: DragEvent) => {
          worldDragState.set(world, {
            entity,
            type: draggable.type,
            data: draggable.data,
          });
          el.style.opacity = '0.5';
          e.dataTransfer?.setData('text/plain', draggable.type);
        },
        dragend: () => {
          worldDragState.set(world, null);
          el.style.opacity = '';
        },
      };

      el.addEventListener('dragstart', handlers.dragstart);
      el.addEventListener('dragend', handlers.dragend);
      dragHandlers.set(entity, handlers);
    }
  },
});

/**
 * Removes drag behavior when Draggable is removed.
 */
export const DraggableRemoveSystem = defineReactiveSystem({
  triggers: [removed(Draggable)],
  execute(entities, world) {
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
export const DroppableAddSystem = defineReactiveSystem({
  triggers: [added(Droppable)],
  execute(entities, world) {
    const domElements = getDOMElements(world);
    const dropHandlers = getDropHandlers(world);

    for (const entity of entities) {
      const el = domElements.get(entity) as HTMLElement;
      const droppable = world.get(entity, Droppable);
      if (!el || !droppable) continue;

      const handlers: DropHandlers = {
        dragover: (e: DragEvent) => {
          const dragState = worldDragState.get(world);
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
          const dragState = worldDragState.get(world);
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
});

/**
 * Removes drop behavior when Droppable is removed.
 */
export const DroppableRemoveSystem = defineReactiveSystem({
  triggers: [removed(Droppable)],
  execute(entities, world) {
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
export const DragOverAddSystem = defineReactiveSystem({
  triggers: [added(DragOver)],
  execute(entities, world) {
    const domElements = getDOMElements(world);

    for (const entity of entities) {
      const el = domElements.get(entity) as HTMLElement;
      if (el) {
        el.classList.add('drag-over');
      }
    }
  },
});

/**
 * Removes visual feedback when DragOver is removed.
 */
export const DragOverRemoveSystem = defineReactiveSystem({
  triggers: [removed(DragOver)],
  execute(entities, world) {
    const domElements = getDOMElements(world);

    for (const entity of entities) {
      const el = domElements.get(entity) as HTMLElement;
      if (el) {
        el.classList.remove('drag-over');
      }
    }
  },
});

/**
 * Registers all DOM systems with the world.
 */
export function registerDOMSystems(world: World): void {
  world.registerSystem(DOMCreateSystem);
  world.registerSystem(DOMRemoveSystem);
  world.registerSystem(ClickableAddSystem);
  world.registerSystem(ClickableRemoveSystem);
  world.registerSystem(DisabledAddSystem);
  world.registerSystem(DisabledRemoveSystem);
  world.registerSystem(TextContentSystem);
  world.registerSystem(ClassesSystem);
  world.registerSystem(DraggableAddSystem);
  world.registerSystem(DraggableRemoveSystem);
  world.registerSystem(DroppableAddSystem);
  world.registerSystem(DroppableRemoveSystem);
  world.registerSystem(DragOverAddSystem);
  world.registerSystem(DragOverRemoveSystem);
}

/**
 * Mount the root entity's DOM element to a container.
 */
export function mount(world: World, rootEntity: EntityId, container: Element): void {
  const el = getDOMElement(world, rootEntity);
  if (el) {
    container.appendChild(el);
  }
}
