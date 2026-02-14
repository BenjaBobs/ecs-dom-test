/**
 * ContentSystem — injects pre-rendered HTML into content area.
 */

import { getDOMElement } from '@ecs-test/dom';
import { defineReactiveSystem, Entities } from '@ecs-test/ecs';
import { HtmlContent } from '../components.ts';

export const ContentSystem = defineReactiveSystem({
  name: 'ContentSystem',
  query: Entities.with([HtmlContent]),
  onEnter(world, entities) {
    for (const entity of entities) {
      const el = getDOMElement(world, entity);
      const data = world.get(entity, HtmlContent);
      if (el && data) {
        el.innerHTML = data.html;
      }
    }
  },
  onUpdate(world, entities) {
    for (const entity of entities) {
      const el = getDOMElement(world, entity);
      const data = world.get(entity, HtmlContent);
      if (el && data) {
        el.innerHTML = data.html;
      }
    }
  },
});
