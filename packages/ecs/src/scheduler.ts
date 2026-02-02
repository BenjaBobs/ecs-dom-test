import type { FlushScheduler } from './world.ts';

export type RafLike = (callback: FrameRequestCallback) => number;
export type MicrotaskLike = (callback: () => void) => void;
export type TimeoutLike = (callback: () => void, ms: number) => void;

const resolved = Promise.resolve();

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

      return workPromise ?? resolved;
    },
    whenIdle() {
      return workPromise ?? resolved;
    },
  };
}

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

      return workPromise ?? resolved;
    },
    whenIdle() {
      return workPromise ?? resolved;
    },
  };
}
