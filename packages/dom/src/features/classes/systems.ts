/**
 * CSS class systems.
 */

import { defineReactiveSystem, Entities } from '@ecs-test/ecs';
import { getDOMElements } from '../../dom-element-systems.ts';
import { Classes } from './components.ts';

/**
 * Updates classes when Classes component changes.
 */
export const ClassesSystem = defineReactiveSystem({
  name: 'ClassesSystem',
  query: Entities.with([Classes]),
  onEnter(world, entities) {
    const domElements = getDOMElements(world);
    for (const entity of entities) {
      const el = domElements.get(entity);
      const classes = world.get(entity, Classes);
      if (el && classes) {
        el.className = classes.list.join(' ');
      }
    }
  },
  onUpdate(world, entities) {
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
