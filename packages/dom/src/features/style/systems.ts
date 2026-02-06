/**
 * Inline style systems.
 */

import { addedOrReplaced, defineReactiveSystem, removed } from '@ecs-test/ecs';
import { getDOMElements } from '../../dom-element-systems.ts';
import { Style } from './components.ts';

/**
 * Updates inline styles when Style changes.
 */
export const StyleSystem = defineReactiveSystem({
  name: 'StyleSystem',
  triggers: [addedOrReplaced(Style)],
  execute(entities, world) {
    const domElements = getDOMElements(world);

    for (const entity of entities) {
      const el = domElements.get(entity) as HTMLElement | undefined;
      const styles = world.get(entity, Style);
      if (el && styles) {
        Object.assign(el.style, styles);
      }
    }
  },
});

/**
 * Clears inline styles when Style is removed.
 */
export const StyleRemoveSystem = defineReactiveSystem({
  name: 'StyleRemoveSystem',
  triggers: [removed(Style)],
  execute(entities, world) {
    const domElements = getDOMElements(world);

    for (const entity of entities) {
      const el = domElements.get(entity) as HTMLElement | undefined;
      if (el) {
        el.removeAttribute('style');
      }
    }
  },
});
