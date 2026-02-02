/**
 * Flush schedulers for controlling when reactive systems execute.
 * @module
 */

import type { FlushScheduler } from './world.ts';

/** Function signature matching requestAnimationFrame */
export type RafLike = (callback: FrameRequestCallback) => number;

/** Function signature for microtask enqueueing */
export type MicrotaskLike = (callback: () => void) => void;

/** Function signature matching setTimeout */
export type TimeoutLike = (callback: () => void, ms: number) => void;

/** Pre-resolved promise for synchronous operations */
const resolved = Promise.resolve();

/**
 * Create a scheduler that executes flushes synchronously and immediately.
 *
 * Features:
 * - Executes callbacks immediately when scheduled
 * - Guards against recursive flushes during execution
 * - Always returns an already-resolved promise
 *
 * @returns A FlushScheduler that executes synchronously
 *
 * @example
 * ```typescript
 * const world = new World({ scheduler: createSyncScheduler() });
 * world.add(entity, Component()); // Flush happens immediately
 * // Effects are visible synchronously
 * ```
 */
export function createSyncScheduler(): FlushScheduler {
  let executing = false;

  return {
    schedule(callback) {
      // If already executing, skip - mutations will be processed by the current flush
      if (executing) return resolved;

      executing = true;
      try {
        callback();
      } finally {
        executing = false;
      }
      return resolved;
    },
    whenIdle() {
      return resolved;
    },
  };
}

/**
 * Create a scheduler that batches flushes using microtasks.
 *
 * Features:
 * - Batches multiple flush requests into a single execution
 * - Executes after current synchronous code completes
 * - Deduplicates concurrent flush requests
 *
 * @param enqueueMicrotask - Function to enqueue a microtask (e.g., queueMicrotask)
 * @returns A FlushScheduler that batches via microtasks
 *
 * @example
 * ```typescript
 * const world = new World({
 *   scheduler: createMicrotaskScheduler(queueMicrotask)
 * });
 * world.add(entity, Component1());
 * world.add(entity, Component2());
 * // Both mutations batched into single flush after microtask
 * await world.whenFlushed();
 * ```
 */
export function createMicrotaskScheduler(enqueueMicrotask: MicrotaskLike): FlushScheduler {
  let workPromise: Promise<void> | null = null;

  return {
    schedule(callback) {
      if (workPromise) return workPromise;

      workPromise = new Promise<void>((resolve, reject) => {
        enqueueMicrotask(() => {
          try {
            callback();
            resolve();
          } catch (error) {
            reject(error);
          } finally {
            workPromise = null;
          }
        });
      });

      return workPromise;
    },
    whenIdle() {
      return workPromise ?? resolved;
    },
  };
}

/**
 * Create a scheduler that batches flushes using requestAnimationFrame.
 *
 * Features:
 * - Batches multiple flush requests into a single execution
 * - Aligns with browser paint cycles for smooth rendering
 * - Falls back to setTimeout(16ms) if no RAF provided
 * - Falls back to synchronous execution if neither provided
 *
 * @param raf - Optional requestAnimationFrame function
 * @param setTimeoutFn - Optional setTimeout fallback
 * @returns A FlushScheduler that batches via animation frames
 *
 * @example
 * ```typescript
 * const world = new World({
 *   scheduler: createRafScheduler(requestAnimationFrame)
 * });
 * // Mutations batched and flushed on next animation frame
 * ```
 */
export function createRafScheduler(raf?: RafLike, setTimeoutFn?: TimeoutLike): FlushScheduler {
  let workPromise: Promise<void> | null = null;

  return {
    schedule(callback) {
      if (workPromise) return workPromise;

      workPromise = new Promise<void>((resolve, reject) => {
        const run = () => {
          try {
            callback();
            resolve();
          } catch (error) {
            reject(error);
          } finally {
            workPromise = null;
          }
        };

        if (raf) {
          raf(run);
        } else if (setTimeoutFn) {
          setTimeoutFn(run, 16);
        } else {
          run();
        }
      });

      return workPromise;
    },
    whenIdle() {
      return workPromise ?? resolved;
    },
  };
}
