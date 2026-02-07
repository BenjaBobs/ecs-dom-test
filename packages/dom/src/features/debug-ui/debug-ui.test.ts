/**
 * Debug UI behavior tests (non-visual).
 */

import { describe, expect, it } from 'bun:test';
import { defineComponent } from '@ecs-test/ecs';
import { Window } from 'happy-dom';
import {
  Clickable,
  createDebugUI,
  DOMElement,
  getDOMElement,
  registerDebugUISystems,
  TextContent,
} from '../../index.ts';
import { withTestWorld } from '../../test-utils/index.ts';
import { DebugUISectionState, DebugUISelection } from './components.ts';

async function waitForDebugUI(world: { whenFlushed(): Promise<void> }) {
  await world.whenFlushed();
}

function findElementByText(root: ParentNode, text: string) {
  return Array.from(root.querySelectorAll('*')).find(node => node.textContent?.includes(text)) as
    | HTMLElement
    | undefined;
}

function findButtonByText(root: ParentNode, text: string) {
  return Array.from(root.querySelectorAll('button')).find(node =>
    node.textContent?.includes(text),
  ) as HTMLButtonElement | undefined;
}

describe('debug ui', () => {
  it('renders a search input and filters tree by intersection tokens', async () => {
    await withTestWorld(new Window(), async ({ world, container }) => {
      registerDebugUISystems(world);
      createDebugUI(world, { visible: true, snapshotThrottleMs: 0, profileSampleMs: 0 });

      const Book = defineComponent<{ title: string }>('Book');
      const parent = world.createEntity(null, [TextContent({ value: 'parent' })]);
      const match = world.createEntity(parent, [Clickable(), Book({ title: 'A' })]);
      const clickOnly = world.createEntity(null, [Clickable()]);
      const bookOnly = world.createEntity(null, [Book({ title: 'B' })]);

      await waitForDebugUI(world);

      const input = container.querySelector(
        'input[placeholder="Search entities..."]',
      ) as HTMLInputElement | null;
      expect(input).not.toBeNull();
      if (!input) return;

      input.value = 'click book';
      input.dispatchEvent(new Event('input'));

      await waitForDebugUI(world);

      const tree = input.parentElement as HTMLElement | null;
      expect(tree).not.toBeNull();
      if (!tree) return;

      const treeText = tree.textContent ?? '';
      expect(treeText).toContain(`Entity ${parent}`);
      expect(treeText).toContain(`Entity ${match}`);
      expect(treeText).not.toContain(`Entity ${clickOnly}`);
      expect(treeText).not.toContain(`Entity ${bookOnly}`);
    });
  });

  it('selects an entity from the tree and shows selection details', async () => {
    await withTestWorld(new Window(), async ({ world, container }) => {
      registerDebugUISystems(world);
      createDebugUI(world, { visible: true, snapshotThrottleMs: 0, profileSampleMs: 0 });

      const entity = world.createEntity(null, [
        DOMElement({ tag: 'div' }),
        TextContent({ value: 'X' }),
      ]);
      await waitForDebugUI(world);

      const label = findElementByText(container, `Entity ${entity}`);
      expect(label).not.toBeUndefined();
      label?.dispatchEvent(new Event('click'));

      await waitForDebugUI(world);

      const selectionPanel = findElementByText(container, `Entity ${entity}`);
      expect(selectionPanel).not.toBeUndefined();
    });
  });

  it('collapses selection section when toggled', async () => {
    await withTestWorld(new Window(), async ({ world, container }) => {
      registerDebugUISystems(world);
      createDebugUI(world, { visible: true, snapshotThrottleMs: 0, profileSampleMs: 0 });

      const entity = world.createEntity(null, [TextContent({ value: 'X' })]);
      await waitForDebugUI(world);

      const input = container.querySelector(
        'input[placeholder="Search entities..."]',
      ) as HTMLInputElement | null;
      const tree = input?.parentElement ?? container;
      const label = findElementByText(tree, `Entity ${entity}`);
      label?.dispatchEvent(new Event('click'));

      await waitForDebugUI(world);

      const selectionHeader = findElementByText(container, 'Selection');
      expect(selectionHeader).not.toBeUndefined();
      selectionHeader?.dispatchEvent(new Event('click'));

      await waitForDebugUI(world);

      const selectionSection = selectionHeader?.parentElement ?? container;
      expect(selectionSection.childElementCount).toBe(1);
    });
  });

  it('toggles tree foldout using the caret', async () => {
    await withTestWorld(new Window(), async ({ world, container }) => {
      registerDebugUISystems(world);
      createDebugUI(world, { visible: true, snapshotThrottleMs: 0, profileSampleMs: 0 });

      const parent = world.createEntity(null, [TextContent({ value: 'parent' })]);
      const child = world.createEntity(parent, [TextContent({ value: 'child' })]);
      await waitForDebugUI(world);

      const input = container.querySelector('input[placeholder="Search entities..."]');
      const tree = input?.parentElement ?? container;
      const caret = findElementByText(tree, '▾') ?? findElementByText(tree, '▸');
      expect(caret).not.toBeUndefined();

      caret?.dispatchEvent(new Event('click'));
      await waitForDebugUI(world);

      const treeText = tree.textContent ?? '';
      expect(treeText).toContain(`Entity ${parent}`);
      expect(treeText).not.toContain(`Entity ${child}`);
    });
  });

  it('keeps selection visible after clearing search', async () => {
    await withTestWorld(new Window(), async ({ world, container }) => {
      registerDebugUISystems(world);
      const root = createDebugUI(world, {
        visible: true,
        snapshotThrottleMs: 0,
        profileSampleMs: 0,
      });

      const parent = world.createEntity(null, [TextContent({ value: 'parent' })]);
      const child = world.createEntity(parent, [Clickable(), TextContent({ value: 'child' })]);
      await waitForDebugUI(world);

      const input = container.querySelector(
        'input[placeholder="Search entities..."]',
      ) as HTMLInputElement | null;
      expect(input).not.toBeNull();
      if (!input) return;

      input.value = 'child';
      input.dispatchEvent(new Event('input'));
      await waitForDebugUI(world);

      world.set(root, DebugUISelection({ entity: child }));
      await waitForDebugUI(world);

      input.value = '';
      input.dispatchEvent(new Event('input'));
      await waitForDebugUI(world);
      await waitForDebugUI(world);

      const tree = input.parentElement ?? container;
      const treeText = tree.textContent ?? '';
      expect(treeText).toContain(`Entity ${parent}`);
      expect(treeText).toContain(`Entity ${child}`);
    });
  });

  it('toggles timeline section visibility', async () => {
    await withTestWorld(new Window(), async ({ world, container }) => {
      registerDebugUISystems(world);
      const root = createDebugUI(world, {
        visible: true,
        snapshotThrottleMs: 0,
        profileSampleMs: 0,
      });

      await waitForDebugUI(world);

      world.set(root, DebugUISectionState({ selectionOpen: true, timelineOpen: false }));
      await waitForDebugUI(world);

      const collapsedText = container.textContent ?? '';
      expect(collapsedText).not.toContain('last 20 samples');

      world.set(root, DebugUISectionState({ selectionOpen: true, timelineOpen: true }));
      await waitForDebugUI(world);

      const includeButton = findButtonByText(container, 'Include Debug UI');
      expect(includeButton).not.toBeUndefined();
    });
  });

  it('toggles include debug ui label', async () => {
    await withTestWorld(new Window(), async ({ world, container }) => {
      registerDebugUISystems(world);
      createDebugUI(world, { visible: true, snapshotThrottleMs: 0, profileSampleMs: 0 });

      await waitForDebugUI(world);

      const includeButton = findButtonByText(container, 'Include Debug UI');
      expect(includeButton).not.toBeUndefined();
      includeButton?.dispatchEvent(new Event('click'));
      await waitForDebugUI(world);

      const excludeButton = findButtonByText(container, 'Exclude Debug UI');
      expect(excludeButton).not.toBeUndefined();
    });
  });

  it('highlights multiple search tokens in tree rows', async () => {
    await withTestWorld(new Window(), async ({ world, container }) => {
      registerDebugUISystems(world);
      createDebugUI(world, { visible: true, snapshotThrottleMs: 0, profileSampleMs: 0 });

      const Book = defineComponent<{ title: string }>('Book');
      const entity = world.createEntity(null, [Clickable(), Book({ title: 'X' })]);
      await waitForDebugUI(world);

      const input = container.querySelector(
        'input[placeholder="Search entities..."]',
      ) as HTMLInputElement | null;
      expect(input).not.toBeNull();
      if (!input) return;

      input.value = 'click book';
      input.dispatchEvent(new Event('input'));
      await waitForDebugUI(world);

      const tree = input.parentElement ?? container;
      const row = findElementByText(tree, `Entity ${entity}`);
      expect(row).not.toBeUndefined();

      const highlightSpans = row
        ? Array.from(row.querySelectorAll('span')).filter(
            span =>
              span.textContent?.toLowerCase() === 'click' ||
              span.textContent?.toLowerCase() === 'book',
          )
        : [];
      expect(highlightSpans.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('allows collapsing selected entity with caret', async () => {
    await withTestWorld(new Window(), async ({ world, container }) => {
      registerDebugUISystems(world);
      createDebugUI(world, { visible: true, snapshotThrottleMs: 0, profileSampleMs: 0 });

      const parent = world.createEntity(null, [TextContent({ value: 'parent' })]);
      const child = world.createEntity(parent, [TextContent({ value: 'child' })]);
      await waitForDebugUI(world);

      const input = container.querySelector('input[placeholder="Search entities..."]');
      const tree = input?.parentElement ?? container;
      const label = findElementByText(tree, `Entity ${parent}`);
      label?.dispatchEvent(new Event('click'));
      await waitForDebugUI(world);

      const caret = findElementByText(tree, '▾') ?? findElementByText(tree, '▸');
      caret?.dispatchEvent(new Event('click'));
      await waitForDebugUI(world);

      const treeText = tree.textContent ?? '';
      expect(treeText).toContain(`Entity ${parent}`);
      expect(treeText).not.toContain(`Entity ${child}`);
    });
  });

  it('toggles debug ui via hotkey', async () => {
    const window = new Window();
    await withTestWorld(window, async ({ world }) => {
      registerDebugUISystems(world);
      const debugRoot = createDebugUI(world, { snapshotThrottleMs: 0, profileSampleMs: 0 });

      window.dispatchEvent(
        new window.KeyboardEvent('keydown', { key: 'd', ctrlKey: true, shiftKey: true }),
      );
      await waitForDebugUI(world);

      const panel = getDOMElement(world, debugRoot);
      expect(panel).not.toBeUndefined();

      window.dispatchEvent(
        new window.KeyboardEvent('keydown', { key: 'd', ctrlKey: true, shiftKey: true }),
      );
      await waitForDebugUI(world);

      const removedPanel = getDOMElement(world, debugRoot);
      expect(removedPanel).toBeUndefined();
    });
  });
});
