// @minimap summary: Adds and removes the disabled CSS class on DOM elements for entities marked with Disabled.
// @minimap tags: dom disabled system class styling state
/**
 * Disabled state systems.
 */

import { defineReactiveSystem, Entities } from '@ecs-test/ecs';
import { getDOMElements } from '../../dom-element-systems.ts';
import { Disabled } from './components.ts';

/**
 * Adds disabled class when Disabled is added.
 */
export const DisabledSystem = defineReactiveSystem({
  name: 'DisabledSystem',
  query: Entities.with([Disabled]),
  onEnter(world, entities) {
    const domElements = getDOMElements(world);
    for (const entity of entities) {
      const el = domElements.get(entity);
      if (el) {
        el.classList.add('disabled');
      }
    }
  },
  onExit(world, entities) {
    const domElements = getDOMElements(world);
    for (const entity of entities) {
      const el = domElements.get(entity);
      if (el) {
        el.classList.remove('disabled');
      }
    }
  },
});
