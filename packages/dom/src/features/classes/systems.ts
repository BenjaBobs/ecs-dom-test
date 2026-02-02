/**
 * CSS class systems.
 */

import { addedOrReplaced, defineReactiveSystem } from '@ecs-test/ecs';
import { getDOMElements } from '../../dom-element-systems.ts';
import { Classes } from './components.ts';

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
