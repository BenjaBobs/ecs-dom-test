/**
 * PlaygroundSystem — hydrates [data-playground] placeholders with an iframe.
 */

import { getDOMElement } from '@ecs-test/dom';
import { defineReactiveSystem, Entities } from '@ecs-test/ecs';
import { HtmlContent } from '../components.ts';

function hydratePlaygrounds(root: Element): void {
  const doc = root.ownerDocument;
  const placeholders = root.querySelectorAll('[data-playground]:not([data-hydrated])');

  for (const placeholder of Array.from(placeholders)) {
    if (!(placeholder instanceof HTMLElement)) {
      continue;
    }

    const src = placeholder.dataset.src ?? '/playground/index.html';
    const height = placeholder.dataset.height ?? '520';

    const frame = doc.createElement('iframe');
    frame.className = 'playground-frame';
    frame.loading = 'lazy';
    frame.src = src;
    frame.title = 'Interactive ECS playground';
    frame.style.height = `${Number.parseInt(height, 10) || 520}px`;

    const openLink = doc.createElement('a');
    openLink.href = src;
    openLink.target = '_blank';
    openLink.rel = 'noreferrer';
    openLink.className = 'playground-open-link';
    openLink.textContent = 'Open playground in new tab';

    placeholder.append(frame, openLink);
    placeholder.dataset.hydrated = 'true';
  }
}

export const PlaygroundSystem = defineReactiveSystem({
  name: 'PlaygroundSystem',
  query: Entities.with([HtmlContent]),
  onEnter(world, entities) {
    for (const entity of entities) {
      const el = getDOMElement(world, entity);
      if (!el) continue;
      hydratePlaygrounds(el);
    }
  },
  onUpdate(world, entities) {
    for (const entity of entities) {
      const el = getDOMElement(world, entity);
      if (!el) continue;
      hydratePlaygrounds(el);
    }
  },
});
