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
 *
 * If the Clickable component has an `onClick` handler, the handler is called
 * directly on click. Otherwise, the entity receives a transient `Clicked`
 * marker that downstream systems can query for.
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

      const clickableData = world.get(entity, Clickable);
      const onClick = clickableData?.onClick;

      const handler = () => {
        if (world.has(entity, Disabled)) return;
        if (onClick) {
          // Direct handler — call it and flush for any mutations it made
          onClick(world, entity);
          world.flush();
        } else {
          // Marker-based — set Clicked for downstream systems to consume
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
