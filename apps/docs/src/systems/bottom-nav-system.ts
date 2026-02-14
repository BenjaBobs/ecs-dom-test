/**
 * BottomNavSystem — renders prev/next page links.
 */

import { getDOMElement } from '@ecs-test/dom';
import { defineReactiveSystem, Entities } from '@ecs-test/ecs';
import { BottomNavData } from '../components.ts';

function renderBottomNav(
  el: Element,
  data: { prev?: { title: string; slug: string }; next?: { title: string; slug: string } },
) {
  let html = '';

  if (data.prev) {
    html += `<a href="/${data.prev.slug}.html" class="bottom-nav-link prev">`;
    html += `<span class="bottom-nav-direction">Previous</span>`;
    html += `<span class="bottom-nav-title">${escapeHtml(data.prev.title)}</span>`;
    html += `</a>`;
  } else {
    html += `<span></span>`;
  }

  if (data.next) {
    html += `<a href="/${data.next.slug}.html" class="bottom-nav-link next">`;
    html += `<span class="bottom-nav-direction">Next</span>`;
    html += `<span class="bottom-nav-title">${escapeHtml(data.next.title)}</span>`;
    html += `</a>`;
  }

  el.innerHTML = html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const BottomNavSystem = defineReactiveSystem({
  name: 'BottomNavSystem',
  query: Entities.with([BottomNavData]),
  onEnter(world, entities) {
    for (const entity of entities) {
      const el = getDOMElement(world, entity);
      const data = world.get(entity, BottomNavData);
      if (el && data) renderBottomNav(el, data);
    }
  },
  onUpdate(world, entities) {
    for (const entity of entities) {
      const el = getDOMElement(world, entity);
      const data = world.get(entity, BottomNavData);
      if (el && data) renderBottomNav(el, data);
    }
  },
});
