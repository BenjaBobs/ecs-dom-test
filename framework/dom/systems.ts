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
} from "../ecs/index.ts";
import {
  DOMElement,
  TextContent,
  Classes,
  Clickable,
  Clicked,
  Disabled,
} from "./components.ts";

/** Map from entity ID to actual DOM element */
const domElements = new Map<EntityId, Element>();

/** Map from entity ID to click handler (for removal) */
const clickHandlers = new Map<EntityId, () => void>();

/** Get the DOM element for an entity */
export function getDOMElement(entity: EntityId): Element | undefined {
  return domElements.get(entity);
}

/**
 * Creates DOM elements when DOMElement component is added.
 * Only creates the node - other systems handle behavior.
 */
export const DOMCreateSystem = defineReactiveSystem({
  triggers: [added(DOMElement)],
  execute(entities, world) {
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
  execute(entities) {
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
    for (const entity of entities) {
      const el = domElements.get(entity);
      if (!el) continue;

      // Remove existing handler if any
      const existingHandler = clickHandlers.get(entity);
      if (existingHandler) {
        el.removeEventListener("click", existingHandler);
      }

      const handler = () => {
        if (!world.has(entity, Disabled)) {
          world.set(entity, Clicked());
          world.flush();
        }
      };

      el.addEventListener("click", handler);
      clickHandlers.set(entity, handler);
      (el as HTMLElement).style.cursor = "pointer";
    }
  },
});

/**
 * Removes click handler when Clickable is removed.
 */
export const ClickableRemoveSystem = defineReactiveSystem({
  triggers: [removed(Clickable)],
  execute(entities) {
    for (const entity of entities) {
      const el = domElements.get(entity);
      const handler = clickHandlers.get(entity);

      if (el && handler) {
        el.removeEventListener("click", handler);
        (el as HTMLElement).style.cursor = "";
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
  execute(entities) {
    for (const entity of entities) {
      const el = domElements.get(entity);
      if (el) {
        el.classList.add("disabled");
      }
    }
  },
});

/**
 * Removes disabled class when Disabled is removed.
 */
export const DisabledRemoveSystem = defineReactiveSystem({
  triggers: [removed(Disabled)],
  execute(entities) {
    for (const entity of entities) {
      const el = domElements.get(entity);
      if (el) {
        el.classList.remove("disabled");
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
    for (const entity of entities) {
      const el = domElements.get(entity);
      const classes = world.get(entity, Classes);
      if (el && classes) {
        el.className = classes.list.join(" ");
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
}

/**
 * Mount the root entity's DOM element to a container.
 */
export function mount(rootEntity: EntityId, container: Element): void {
  const el = domElements.get(rootEntity);
  if (el) {
    container.appendChild(el);
  }
}
