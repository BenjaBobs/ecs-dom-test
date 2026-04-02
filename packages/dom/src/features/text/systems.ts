// @minimap summary: Updates DOM textContent from the TextContent ECS component whenever matching entities enter or update.
// @minimap tags: dom text system textContent render sync
/**
 * Text content systems.
 */

import { defineReactiveSystem, Entities } from '@ecs-test/ecs';
import { getDOMElements } from '../../dom-element-systems.ts';
import { TextContent } from './components.ts';

/**
 * Updates text content when TextContent changes.
 */
export const TextContentSystem = defineReactiveSystem({
  name: 'TextContentSystem',
  query: Entities.with([TextContent]),
  onEnter(world, entities) {
    const domElements = getDOMElements(world);
    for (const entity of entities) {
      const el = domElements.get(entity);
      const text = world.get(entity, TextContent);
      if (el && text) {
        el.textContent = text.value;
      }
    }
  },
  onUpdate(world, entities) {
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
