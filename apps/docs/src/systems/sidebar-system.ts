// @minimap summary: Renders the docs sidebar navigation links, active state, and relative hrefs from NavItemData components.
// @minimap tags: docs sidebar navigation active links ecs
/**
 * SidebarSystem — renders sidebar nav items with active state.
 */

import { Classes, getDOMElement } from '@ecs-test/dom';
import { defineReactiveSystem, Entities } from '@ecs-test/ecs';
import { NavItemData } from '../components.ts';
import { pathToRoot } from '../site-root.ts';

export const SidebarSystem = defineReactiveSystem({
  name: 'SidebarSystem',
  query: Entities.with([NavItemData]),
  onEnter(world, entities) {
    for (const entity of entities) {
      const data = world.get(entity, NavItemData);
      const el = getDOMElement(world, entity) as HTMLAnchorElement | undefined;
      if (!data || !el) continue;

      const classes = ['sidebar-link'];
      if (data.isActive) classes.push('active');
      world.set(entity, Classes({ list: classes }));

      el.href = `${pathToRoot}${data.slug}.html`;
      el.textContent = data.title;
      if (data.isActive) {
        el.setAttribute('aria-current', 'page');
      } else {
        el.removeAttribute('aria-current');
      }
    }
  },
  onUpdate(world, entities) {
    for (const entity of entities) {
      const data = world.get(entity, NavItemData);
      const el = getDOMElement(world, entity) as HTMLAnchorElement | undefined;
      if (!data || !el) continue;

      const classes = ['sidebar-link'];
      if (data.isActive) classes.push('active');
      world.set(entity, Classes({ list: classes }));

      el.href = `${pathToRoot}${data.slug}.html`;
      el.textContent = data.title;
      if (data.isActive) {
        el.setAttribute('aria-current', 'page');
      } else {
        el.removeAttribute('aria-current');
      }
    }
  },
});
