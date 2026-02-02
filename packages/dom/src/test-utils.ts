/**
 * Test utilities for @ecs-test/dom.
 * Provides isolated test environments with automatic cleanup.
 */

import { createSyncScheduler, World, type WorldOptions } from '@ecs-test/ecs';
import { registerDOMSystems, setRootContainer } from './systems.ts';

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
    },
  });

  registerDOMSystems(world);
  setRootContainer(world, container);

  try {
    return fn({ world, container });
  } finally {
    container.remove();
  }
}
