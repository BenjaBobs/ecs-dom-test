// @minimap summary: Creates, mounts, looks up, and removes DOM nodes for entities with DOMElement while storing per-world element mappings.
// @minimap tags: dom system mount unmount render element mapping ecs
/**
 * DOM element creation/removal systems.
 */

import { assert, defineReactiveSystem, Entities, type EntityId, type World } from '@ecs-test/ecs';
import { DOMElement, DOMElements } from './dom-element-components.ts';

type AppliedAttrsState = {
  attrsByEntity: Map<EntityId, Set<string>>;
};

const DOM_ATTRS_STATE = Symbol('DOMElementAttrsState');

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

function getAppliedAttrsState(world: World): AppliedAttrsState {
  const runtimeEntity = world as World & {
    [DOM_ATTRS_STATE]?: Map<EntityId, Set<string>>;
  };

  if (!runtimeEntity[DOM_ATTRS_STATE]) {
    runtimeEntity[DOM_ATTRS_STATE] = new Map<EntityId, Set<string>>();
  }

  return { attrsByEntity: runtimeEntity[DOM_ATTRS_STATE] as Map<EntityId, Set<string>> };
}

function applyDOMElementAttrs(
  world: World,
  entity: EntityId,
  el: Element,
  spec: { tag: string; attrs?: Record<string, unknown> },
): void {
  const state = getAppliedAttrsState(world);
  const previouslyApplied = state.attrsByEntity.get(entity) ?? new Set<string>();
  const nextAttrs = spec.attrs ?? {};
  const nextKeys = new Set(Object.keys(nextAttrs));

  for (const key of previouslyApplied) {
    if (!nextKeys.has(key)) {
      clearAttr(world, el, spec.tag, key);
    }
  }

  for (const [key, value] of Object.entries(nextAttrs)) {
    setAttr(el, key, value);
  }

  if (nextKeys.size > 0) {
    state.attrsByEntity.set(entity, nextKeys);
  } else {
    state.attrsByEntity.delete(entity);
  }
}

function setAttr(el: Element, key: string, value: unknown): void {
  if (key === 'class' || key === 'style') {
    throw new Error(
      `DOMElement.attrs does not support "${key}". Use the dedicated ECS feature instead.`,
    );
  }
  if (key === 'innerHTML' || key === 'textContent') {
    throw new Error(
      `DOMElement.attrs does not support "${key}". Use content ECS features instead.`,
    );
  }
  if (key === 'value' || key === 'checked') {
    throw new Error(`DOMElement.attrs does not support reactive "${key}" synchronization.`);
  }
  if (key.startsWith('on')) {
    throw new Error(`DOMElement.attrs does not support event handlers like "${key}".`);
  }

  if (value === undefined || value === null) {
    clearAttr(undefined, el, el.tagName.toLowerCase(), key);
    return;
  }

  if (key.startsWith('aria-') || key.startsWith('data-')) {
    el.setAttribute(key, String(value));
    return;
  }

  if (key === 'role') {
    el.setAttribute(key, String(value));
    return;
  }

  const target = el as Element & Record<string, unknown>;
  target[key] = value;

  if (typeof value === 'boolean') {
    if (value) {
      el.setAttribute(key, '');
    } else {
      el.removeAttribute(key);
    }
    return;
  }

  el.setAttribute(key, String(value));
}

function clearAttr(world: World | undefined, el: Element, tag: string, key: string): void {
  el.removeAttribute(key);

  const target = el as Element & Record<string, unknown>;
  if (!(key in target)) {
    return;
  }

  if (!world) {
    target[key] = undefined;
    return;
  }

  const defaults = getCreateElement(world)(tag) as Element & Record<string, unknown>;
  target[key] = defaults[key];
}

/**
 * Creates DOM elements when DOMElement component is added.
 * Only creates the node - other systems handle behavior.
 * Root entities (no parent) are auto-mounted to rootContainer if set.
 */
export const DOMElementSystem = defineReactiveSystem({
  name: 'DOMElementSystem',
  query: Entities.with([DOMElement]),
  onEnter(world, entities) {
    const domElements = getDOMElements(world);
    const createElement = getCreateElement(world);
    const rootContainer = world.getExternals().rootContainer;

    for (const entity of entities) {
      const spec = world.get(entity, DOMElement);
      if (!spec) continue;

      const el = createElement(spec.tag);
      domElements.set(entity, el);
      applyDOMElementAttrs(world, entity, el, spec);

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
  onUpdate(world, entities) {
    const domElements = getDOMElements(world);

    for (const entity of entities) {
      const spec = world.get(entity, DOMElement);
      const el = domElements.get(entity);
      if (!spec || !el) continue;

      applyDOMElementAttrs(world, entity, el, spec);
    }
  },
  onExit(world, entities) {
    const domElements = getDOMElements(world);
    const attrsState = getAppliedAttrsState(world);

    for (const entity of entities) {
      const el = domElements.get(entity);
      if (el) {
        el.remove();
        domElements.delete(entity);
      }
      attrsState.attrsByEntity.delete(entity);
    }
  },
});
