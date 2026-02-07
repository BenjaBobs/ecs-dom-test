/**
 * DOM systems proof-of-concept tests.
 * Demonstrates the withTestWorld pattern for isolated, parallel-safe tests.
 * Note: No manual flush() calls needed - autoFlush handles it.
 */

import { describe, expect, it } from 'bun:test';
import { Window } from 'happy-dom';
import {
  Classes,
  createDebugUI,
  DOMElement,
  getDOMElement,
  registerDebugUISystems,
  Style,
  TextContent,
} from './index.ts';
import { withTestWorld } from './test-utils/index.ts';

describe('DOM systems', () => {
  it('creates and auto-mounts DOM elements', () => {
    withTestWorld(new Window(), ({ world, container }) => {
      world.createEntity(null, [DOMElement({ tag: 'div' })]);

      expect(container.querySelector('div')).not.toBeNull();
    });
  });

  it('renders text content', () => {
    withTestWorld(new Window(), ({ world, container }) => {
      world.createEntity(null, [DOMElement({ tag: 'span' }), TextContent({ value: 'Hello' })]);

      expect(container.querySelector('span')?.textContent).toBe('Hello');
    });
  });

  it('nests children via parent relationship', () => {
    withTestWorld(new Window(), ({ world, container }) => {
      const parent = world.createEntity(null, [DOMElement({ tag: 'div' })]);
      world.createEntity(parent, [DOMElement({ tag: 'span' })]);
      world.createEntity(parent, [DOMElement({ tag: 'span' })]);

      expect(container.querySelectorAll('div > span').length).toBe(2);
    });
  });

  it('updates classes reactively', () => {
    withTestWorld(new Window(), ({ world }) => {
      const entity = world.createEntity(null, [
        DOMElement({ tag: 'div' }),
        Classes({ list: ['active'] }),
      ]);

      const div = getDOMElement(world, entity);
      expect(div?.className).toBe('active');

      world.set(entity, Classes({ list: ['active', 'highlighted'] }));

      expect(div?.className).toBe('active highlighted');
    });
  });

  it('applies and clears inline styles', () => {
    withTestWorld(new Window(), ({ world, container }) => {
      const entity = world.createEntity(null, [
        DOMElement({ tag: 'div' }),
        Style({ color: 'red' }),
      ]);

      const div = container.querySelector('div') as HTMLElement | null;
      expect(div?.style.color).toBe('red');

      world.remove(entity, Style);

      expect(div?.getAttribute('style')).toBeNull();
    });
  });

  it('isolates tests from each other', () => {
    withTestWorld(new Window(), ({ container }) => {
      // Fresh window = fresh document = no contamination
      expect(container.children.length).toBe(0);
    });
  });

  it('supports creating entities with components in one call', () => {
    withTestWorld(new Window(), ({ world, container }) => {
      world.createEntity(null, [
        DOMElement({ tag: 'button' }),
        TextContent({ value: 'Click me' }),
        Classes({ list: ['btn', 'primary'] }),
      ]);

      const button = container.querySelector('button');
      expect(button).not.toBeNull();
      expect(button?.textContent).toBe('Click me');
      expect(button?.className).toBe('btn primary');
    });
  });

  it('supports deeply nested hierarchies', () => {
    withTestWorld(new Window(), ({ world, container }) => {
      const root = world.createEntity(null, [DOMElement({ tag: 'div' })]);
      const child = world.createEntity(root, [DOMElement({ tag: 'ul' })]);
      world.createEntity(child, [DOMElement({ tag: 'li' }), TextContent({ value: 'Item 1' })]);
      world.createEntity(child, [DOMElement({ tag: 'li' }), TextContent({ value: 'Item 2' })]);

      const items = container.querySelectorAll('div > ul > li');
      expect(items.length).toBe(2);
      expect(items[0]?.textContent).toBe('Item 1');
      expect(items[1]?.textContent).toBe('Item 2');
    });
  });

  it('renders debug UI panel', async () => {
    await withTestWorld(new Window(), async ({ world, container }) => {
      registerDebugUISystems(world);
      const debugRoot = createDebugUI(world, { visible: true });
      const entity = world.createEntity(null, [
        DOMElement({ tag: 'div' }),
        TextContent({ value: 'Hello' }),
      ]);

      world.flush();
      await new Promise(resolve => setTimeout(resolve, 150));
      await world.whenFlushed();

      const panel = getDOMElement(world, debugRoot) as HTMLElement | undefined;
      expect(panel).not.toBeUndefined();
      expect(container.textContent).toContain(`Entity ${entity}`);
    });
  });

  it('toggles debug UI via hotkey', () => {
    const window = new Window();
    withTestWorld(window, ({ world }) => {
      registerDebugUISystems(world);
      const debugRoot = createDebugUI(world);

      window.dispatchEvent(
        new window.KeyboardEvent('keydown', { key: 'd', ctrlKey: true, shiftKey: true }),
      );
      world.flush();

      const panel = getDOMElement(world, debugRoot);
      expect(panel).not.toBeUndefined();

      window.dispatchEvent(
        new window.KeyboardEvent('keydown', { key: 'd', ctrlKey: true, shiftKey: true }),
      );
      world.flush();

      const removedPanel = getDOMElement(world, debugRoot);
      expect(removedPanel).toBeUndefined();
    });
  });
});
