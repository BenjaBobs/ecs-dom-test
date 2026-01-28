/**
 * DOM rendering layer - components and systems for DOM manipulation.
 */

import {
  type World,
  type EntityId,
  defineComponent,
  defineMarker,
  defineReactiveSystem,
  added,
  removed,
  addedOrReplaced,
} from "../ecs/index.ts";

// =============================================================================
// DOM Components
// =============================================================================

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

// =============================================================================
// DOM Element Registry
// =============================================================================

/** Map from entity ID to actual DOM element */
const domElements = new Map<EntityId, Element>();

/** Get the DOM element for an entity */
export function getDOMElement(entity: EntityId): Element | undefined {
  return domElements.get(entity);
}

// =============================================================================
// DOM Systems
// =============================================================================

/**
 * Creates DOM elements when DOMElement component is added.
 */
export const DOMCreateSystem = defineReactiveSystem({
  triggers: [added(DOMElement)],
  execute(entities, world) {
    for (const entity of entities) {
      const spec = world.get(entity, DOMElement);
      if (!spec) continue;

      const el = document.createElement(spec.tag);
      if (spec.class) {
        el.className = spec.class;
      }

      // Set up click handling if Clickable
      if (world.has(entity, Clickable._tag) && !world.has(entity, Disabled._tag)) {
        el.addEventListener("click", () => {
          world.add(entity, Clicked());
          world.flush();
        });
        (el as HTMLElement).style.cursor = "pointer";
      }

      // Apply disabled styling
      if (world.has(entity, Disabled._tag)) {
        el.classList.add("disabled");
      }

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
