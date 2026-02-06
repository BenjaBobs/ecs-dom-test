/**
 * Text content systems.
 */

import { addedOrReplaced, defineReactiveSystem } from '@ecs-test/ecs';
import { getDOMElements } from '../../dom-element-systems.ts';
import { TextContent } from './components.ts';

/**
 * Updates text content when TextContent changes.
 */
export const TextContentSystem = defineReactiveSystem({
  name: 'TextContentSystem',
  triggers: [addedOrReplaced(TextContent)],
  execute(entities, world) {
    const domElements = getDOMElements(world);

    for (const entity of entities) {
      const el = domElements.get(entity);
      const text = world.get(entity, TextContent);
      if (el && text) {
        el.textContent = text.value;
      }
    }
  },
});
