import { describe, expect, it } from 'bun:test';
import { createMicrotaskScheduler, createRafScheduler, createSyncScheduler } from './scheduler.ts';

describe('createSyncScheduler', () => {
  it('executes callback immediately', () => {
    const scheduler = createSyncScheduler();
    let executed = false;

    scheduler.schedule(() => {
      executed = true;
    });

    expect(executed).toBe(true);
  });

  it('returns resolved promise', async () => {
    const scheduler = createSyncScheduler();

    const result = scheduler.schedule(() => {});

    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBeUndefined();
  });

  it('guards against recursive execution', () => {
    const scheduler = createSyncScheduler();
    let nestedExecuted = false;

    scheduler.schedule(() => {
      // Try to schedule nested callback
      scheduler.schedule(() => {
        nestedExecuted = true;
      });
    });

    // Nested callback should not execute (guard prevents it)
    expect(nestedExecuted).toBe(false);
  });

  it('allows sequential execution after previous completes', () => {
    const scheduler = createSyncScheduler();
    const executions: number[] = [];

    scheduler.schedule(() => {
      executions.push(1);
    });

    scheduler.schedule(() => {
      executions.push(2);
    });

    expect(executions).toEqual([1, 2]);
  });

  it('whenIdle returns resolved promise', async () => {
    const scheduler = createSyncScheduler();

    await expect(scheduler.whenIdle()).resolves.toBeUndefined();
  });
});

describe('createMicrotaskScheduler', () => {
  it('defers execution to microtask', async () => {
    const scheduler = createMicrotaskScheduler(queueMicrotask);
    let executed = false;

    scheduler.schedule(() => {
      executed = true;
    });

    // Not executed yet
    expect(executed).toBe(false);

    // Wait for microtask
    await scheduler.whenIdle();
    expect(executed).toBe(true);
  });

  it('batches multiple schedule calls into one execution', async () => {
    const scheduler = createMicrotaskScheduler(queueMicrotask);
    let executions = 0;

    scheduler.schedule(() => {
      executions++;
    });

    scheduler.schedule(() => {
      executions++;
    });

    await scheduler.whenIdle();

    // Only first callback should execute (deduplication)
    expect(executions).toBe(1);
  });

  it('allows new schedule after previous completes', async () => {
    const scheduler = createMicrotaskScheduler(queueMicrotask);
    const executions: number[] = [];

    scheduler.schedule(() => {
      executions.push(1);
    });

    await scheduler.whenIdle();

    scheduler.schedule(() => {
      executions.push(2);
    });

    await scheduler.whenIdle();

    expect(executions).toEqual([1, 2]);
  });

  it('propagates errors through promise', async () => {
    const scheduler = createMicrotaskScheduler(queueMicrotask);

    const promise = scheduler.schedule(() => {
      throw new Error('Test error');
    });

    await expect(promise).rejects.toThrow('Test error');
  });
});

describe('createRafScheduler', () => {
  it('executes callback via provided raf function', async () => {
    const callbacks: Array<() => void> = [];
    const mockRaf = (cb: FrameRequestCallback) => {
      callbacks.push(() => cb(0));
      return 1;
    };

    const scheduler = createRafScheduler(mockRaf);
    let executed = false;

    scheduler.schedule(() => {
      executed = true;
    });

    expect(executed).toBe(false);

    // Simulate RAF firing
    callbacks[0]?.();

    expect(executed).toBe(true);
  });

  it('falls back to setTimeout when no raf provided', async () => {
    const callbacks: Array<() => void> = [];
    const mockSetTimeout = (cb: () => void, _ms: number) => {
      callbacks.push(cb);
    };

    const scheduler = createRafScheduler(undefined, mockSetTimeout);
    let executed = false;

    scheduler.schedule(() => {
      executed = true;
    });

    expect(executed).toBe(false);

    // Simulate timeout firing
    callbacks[0]?.();

    expect(executed).toBe(true);
  });

  it('falls back to sync execution when neither provided', () => {
    const scheduler = createRafScheduler();
    let executed = false;

    scheduler.schedule(() => {
      executed = true;
    });

    expect(executed).toBe(true);
  });

  it('batches multiple schedule calls', async () => {
    const callbacks: Array<() => void> = [];
    const mockRaf = (cb: FrameRequestCallback) => {
      callbacks.push(() => cb(0));
      return 1;
    };

    const scheduler = createRafScheduler(mockRaf);
    let executions = 0;

    scheduler.schedule(() => {
      executions++;
    });

    scheduler.schedule(() => {
      executions++;
    });

    callbacks[0]?.();

    expect(executions).toBe(1);
  });
});
