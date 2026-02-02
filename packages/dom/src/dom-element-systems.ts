/**
 * DOM element creation/removal systems.
 */

import {
  added,
  assert,
  defineReactiveSystem,
  type EntityId,
  removed,
  type World,
} from '@ecs-test/ecs';
import { DOMElement, DOMElements } from './dom-element-components.ts';

function getDOMElementsState(world: World) {
  const runtimeId = world.getRuntimeEntity();
  let state = world.get(runtimeId, DOMElements);
  if (!state) {
    state = { elements: new Map() };
    world.set(runtimeId, DOMElements(state));
  }
  return state;
}

/** Get or create the DOM elements map for a world */
export function getDOMElements(world: World): Map<EntityId, Element> {
  return getDOMElementsState(world).elements as Map<EntityId, Element>;
}

function getCreateElement(world: World): (tag: string) => Element {
  const externals = world.getExternals();
  assert(!!externals.createElement, 'World externals missing createElement');
  return externals.createElement;
}

/** Get the DOM element for an entity in a world */
export function getDOMElement(world: World, entity: EntityId): Element | undefined {
  return getDOMElements(world).get(entity);
}

/**
 * Creates DOM elements when DOMElement component is added.
 * Only creates the node - other systems handle behavior.
 * Root entities (no parent) are auto-mounted to rootContainer if set.
 */
export const DOMCreateSystem = defineReactiveSystem({
  triggers: [added(DOMElement)],
  execute(entities, world) {
    const domElements = getDOMElements(world);
    const createElement = getCreateElement(world);
    const rootContainer = world.getExternals().rootContainer;

    for (const entity of entities) {
      const spec = world.get(entity, DOMElement);
      if (!spec) continue;

      const el = createElement(spec.tag);
      domElements.set(entity, el);

      // Attach to parent's DOM element or root container
      const parentId = world.getParent(entity);
      if (parentId !== undefined) {
        const parentEl = domElements.get(parentId);
        if (parentEl) {
          parentEl.appendChild(el);
        }
      } else if (rootContainer) {
        rootContainer.appendChild(el);
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

    for (const entity of entities) {
      const el = domElements.get(entity);
      if (el) {
        el.remove();
        domElements.delete(entity);
      }
    }
  },
});
