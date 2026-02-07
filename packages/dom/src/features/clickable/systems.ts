/**
 * Click interaction systems.
 */

import type { World } from '@ecs-test/ecs';
import { defineReactiveSystem, Entities } from '@ecs-test/ecs';
import { getDOMElements } from '../../dom-element-systems.ts';
import { Disabled } from '../disabled/components.ts';
import { Clickable, Clicked, ClickHandlers } from './components.ts';

function getClickHandlers(world: World): Map<number, () => void> {
  const runtimeId = world.getRuntimeEntity();
  let state = world.get(runtimeId, ClickHandlers);
  if (!state) {
    state = { handlers: new Map() };
    world.set(runtimeId, ClickHandlers(state));
  }
  return state.handlers as Map<number, () => void>;
}

/**
 * Attaches click handler when Clickable is added.
 */
export const ClickableSystem = defineReactiveSystem({
  name: 'ClickableSystem',
  query: Entities.with([Clickable]),
  onEnter(world, entities) {
    const domElements = getDOMElements(world);
    const clickHandlers = getClickHandlers(world);

    for (const entity of entities) {
      const el = domElements.get(entity);
      if (!el) continue;

      // Remove existing handler if any
      const existingHandler = clickHandlers.get(entity);
      if (existingHandler) {
        el.removeEventListener('click', existingHandler);
      }

      const handler = () => {
        if (!world.has(entity, Disabled)) {
          world.set(entity, Clicked());
          world.flush();
        }
      };

      el.addEventListener('click', handler);
      clickHandlers.set(entity, handler);
      (el as HTMLElement).style.cursor = 'pointer';
    }
  },
  onExit(world, entities) {
    const domElements = getDOMElements(world);
    const clickHandlers = getClickHandlers(world);

    for (const entity of entities) {
      const el = domElements.get(entity);
      const handler = clickHandlers.get(entity);

      if (el && handler) {
        el.removeEventListener('click', handler);
        (el as HTMLElement).style.cursor = '';
      }
      clickHandlers.delete(entity);
    }
  },
});
