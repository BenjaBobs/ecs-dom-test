/**
 * Test utilities for @ecs-test/dom.
 * Provides isolated test environments with automatic cleanup.
 */

import { createSyncScheduler, World, type WorldOptions } from '@ecs-test/ecs';
import { DebugUIRoot, DebugUIVisible } from '../features/debug-ui/components.ts';
import { registerDOMSystems } from '../index.ts';

/**
 * Minimal interface for browser-like window objects.
 * Allows tests to use happy-dom, jsdom, or real browser Window.
 * Uses structural typing with only required methods to accommodate different DOM implementations.
 */
export type WindowLike = {
  document: {
    createElement(tag: string): unknown;
    body: { appendChild(child: unknown): unknown };
  };
};

/** Context provided to test functions */
export type TestWorldContext = {
  /** The ECS world configured for testing */
  world: World;
  /** The container element where root entities are mounted */
  container: HTMLElement;
};

/** Options for withTestWorld, excluding externals (provided automatically) */
export type TestWorldOptions = Omit<WorldOptions, 'externals'>;

/**
 * Execute a test function with an isolated ECS world and DOM container.
 * Automatically registers DOM systems, sets up auto-mount, and cleans up after.
 *
 * @param window - A browser-like window object (e.g., happy-dom Window)
 * @param fn - The test function to execute
 * @param options - Optional World configuration (scheduler, etc.)
 * @returns The return value of the test function
 *
 * @example
 * ```typescript
 * import { Window } from 'happy-dom';
 *
 * it('creates elements', () => {
 *   withTestWorld(new Window(), ({ world, container }) => {
 *     world.createEntity(null, [DOMElement({ tag: 'div' })]);
 *     world.flush();
 *     expect(container.querySelector('div')).not.toBeNull();
 *   });
 * });
 * ```
 */
export function withTestWorld<T>(
  window: WindowLike,
  fn: (ctx: TestWorldContext) => T,
  options?: TestWorldOptions,
): T {
  const container = window.document.createElement('div') as HTMLElement;
  window.document.body.appendChild(container);

  const world = new World({
    ...options,
    scheduler: options?.scheduler ?? createSyncScheduler(),
    externals: {
      createElement: (tag: string) => window.document.createElement(tag) as Element,
      rootContainer: container,
      window: window as unknown as Window,
    },
  });

  registerDOMSystems(world);

  let result: T;
  try {
    result = fn({ world, container });
  } catch (error) {
    container.remove();
    throw error;
  }
  const closeWindow = () => {
    const maybeWindow = window as unknown as {
      close?: () => void;
      happyDOM?: { cancelAsync?: () => Promise<void> | void; close?: () => Promise<void> | void };
    };
    if (maybeWindow.happyDOM?.cancelAsync) {
      maybeWindow.happyDOM.cancelAsync();
    }
    if (maybeWindow.happyDOM?.close) {
      maybeWindow.happyDOM.close();
    }
    if (typeof maybeWindow.close === 'function') {
      maybeWindow.close();
    }
  };

  const cleanup = () => {
    let removedDebugUI = false;
    for (const entity of world.getEntities()) {
      if (world.has(entity, DebugUIRoot) && world.has(entity, DebugUIVisible)) {
        world.remove(entity, DebugUIVisible);
        removedDebugUI = true;
      }
    }

    const finish = () => {
      container.remove();
      closeWindow();
    };

    if (removedDebugUI) {
      const flushed = world.flush();
      if (flushed && typeof (flushed as Promise<unknown>).finally === 'function') {
        return (flushed as Promise<unknown>).finally(finish);
      }
    }

    finish();
    return undefined;
  };

  if (result && typeof (result as { finally?: unknown }).finally === 'function') {
    const maybePromise = result as unknown as Promise<unknown>;
    return maybePromise.finally(() => cleanup()) as T;
  }
  cleanup();
  return result;
}
