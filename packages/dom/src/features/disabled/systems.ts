/**
 * Disabled state systems.
 */

import { added, defineReactiveSystem, removed } from '@ecs-test/ecs';
import { getDOMElements } from '../../dom-element-systems.ts';
import { Disabled } from './components.ts';

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
