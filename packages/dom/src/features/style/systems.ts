/**
 * Inline style systems.
 */

import { defineReactiveSystem, Entities } from '@ecs-test/ecs';
import { getDOMElements } from '../../dom-element-systems.ts';
import { Style } from './components.ts';

/**
 * Updates inline styles when Style changes.
 */
export const StyleSystem = defineReactiveSystem({
  name: 'StyleSystem',
  query: Entities.with([Style]),
  onEnter(world, entities) {
    const domElements = getDOMElements(world);
    for (const entity of entities) {
      const el = domElements.get(entity) as HTMLElement | undefined;
      const styles = world.get(entity, Style);
      if (el && styles) {
        Object.assign(el.style, styles);
      }
    }
  },
  onUpdate(world, entities) {
    const domElements = getDOMElements(world);
    for (const entity of entities) {
      const el = domElements.get(entity) as HTMLElement | undefined;
      const styles = world.get(entity, Style);
      if (el && styles) {
        Object.assign(el.style, styles);
      }
    }
  },
  onExit(world, entities) {
    const domElements = getDOMElements(world);
    for (const entity of entities) {
      const el = domElements.get(entity) as HTMLElement | undefined;
      if (el) {
        el.removeAttribute('style');
      }
    }
  },
});
