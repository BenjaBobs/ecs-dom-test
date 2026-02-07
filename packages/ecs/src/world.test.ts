import { describe, expect, it } from 'bun:test';
import {
  createMicrotaskScheduler,
  Debug,
  type DebugBuffer,
  DebugChildren,
  defineComponent,
  defineMarker,
  defineReactiveSystem,
  Entities,
  registerDebugSystems,
  World,
} from './index.ts';

const Position = defineComponent<{ x: number; y: number }>('Position');
const Velocity = defineComponent<{ x: number; y: number }>('Velocity');
const Selected = defineMarker('Selected');
const Health = defineComponent<{ value: number }>('Health');

describe('World', () => {
  it('creates entities and manages components', () => {
    const world = new World();
    const entity = world.createEntity();

    world.add(entity, Position({ x: 1, y: 2 }));
    expect(world.has(entity, Position)).toBe(true);
    expect(world.get(entity, Position)).toEqual({ x: 1, y: 2 });

    world.set(entity, Position({ x: 3, y: 4 }));
    expect(world.get(entity, Position)).toEqual({ x: 3, y: 4 });

    world.remove(entity, Position);
    expect(world.has(entity, Position)).toBe(false);
  });

  it('queries entities by component tags', () => {
    const world = new World();
    const e1 = world.createEntity();
    const e2 = world.createEntity();
    const e3 = world.createEntity();

    world.add(e1, Position({ x: 0, y: 0 }));
    world.add(e1, Velocity({ x: 1, y: 1 }));
    world.add(e2, Position({ x: 5, y: 5 }));
    world.add(e3, Velocity({ x: 2, y: 2 }));

    expect(world.query(Position._tag).sort()).toEqual([e1, e2].sort());
    expect(world.query(Velocity._tag).sort()).toEqual([e1, e3].sort());
    expect(world.query(Position._tag, Velocity._tag)).toEqual([e1]);
  });

  it('removes entities recursively', () => {
    const world = new World();
    const parent = world.createEntity();
    const child = world.createEntity(parent);
    world.add(parent, Position({ x: 0, y: 0 }));
    world.add(child, Position({ x: 1, y: 1 }));

    world.removeEntity(parent);
    expect(world.exists(parent)).toBe(false);
    expect(world.exists(child)).toBe(false);
  });

  it('runs reactive systems with queries', () => {
    const world = new World({ autoFlush: false });
    const entity = world.createEntity();
    let executed = 0;

    world.registerSystem(
      defineReactiveSystem({
        query: Entities.with([Position, Selected]),
        onEnter(_world, entities) {
          executed += entities.length;
        },
      }),
    );

    world.add(entity, Position({ x: 1, y: 2 }));
    world.add(entity, Selected());
    world.flush();

    expect(executed).toBe(1);
  });

  it('dedupes entities across multiple matching mutations', () => {
    const world = new World({ autoFlush: false });
    const entity = world.createEntity();
    let executions = 0;

    world.registerSystem(
      defineReactiveSystem({
        query: Entities.with([Position]),
        onUpdate(_world, entities) {
          executions += entities.length;
        },
      }),
    );

    world.add(entity, Position({ x: 0, y: 0 }));
    world.set(entity, Position({ x: 1, y: 1 }));
    world.flush();

    expect(executions).toBe(1);
  });

  it('supports onExit callbacks', () => {
    const world = new World();
    const entity = world.createEntity();
    let removedCount = 0;

    world.registerSystem(
      defineReactiveSystem({
        query: Entities.with([Position]),
        onExit(_world, entities) {
          removedCount += entities.length;
        },
      }),
    );

    world.add(entity, Position({ x: 2, y: 3 }));
    world.remove(entity, Position);
    world.flush();

    expect(removedCount).toBe(1);
  });

  it('batches mutations into single flush', () => {
    const world = new World(); // autoFlush enabled by default
    const entity = world.createEntity();
    let executions = 0;

    world.registerSystem(
      defineReactiveSystem({
        query: Entities.with([Position]),
        onUpdate(_world, entities) {
          executions += entities.length;
        },
      }),
    );

    world.batch(() => {
      world.add(entity, Position({ x: 0, y: 0 }));
      world.set(entity, Position({ x: 1, y: 1 }));
      world.set(entity, Position({ x: 2, y: 2 }));
    });

    // All mutations batched into one flush, entity deduped
    expect(executions).toBe(1);
  });

  it('supports nested batches', () => {
    const world = new World();
    const e1 = world.createEntity();
    const e2 = world.createEntity();
    let executions = 0;

    world.registerSystem(
      defineReactiveSystem({
        query: Entities.with([Position]),
        onEnter(_world, entities) {
          executions += entities.length;
        },
      }),
    );

    world.batch(() => {
      world.add(e1, Position({ x: 0, y: 0 }));
      world.batch(() => {
        world.add(e2, Position({ x: 1, y: 1 }));
      });
      // Inner batch doesn't flush
      expect(executions).toBe(0);
    });

    // Outer batch flushes all, both entities processed
    expect(executions).toBe(2);
  });

  it('schedules async flushes and can await completion', async () => {
    const world = new World({
      scheduler: createMicrotaskScheduler(callback => Promise.resolve().then(callback)),
    });
    const entity = world.createEntity();
    let executed = 0;

    world.registerSystem(
      defineReactiveSystem({
        query: Entities.with([Position]),
        onEnter(_world, entities) {
          executed += entities.length;
        },
      }),
    );

    world.add(entity, Position({ x: 1, y: 2 }));
    world.flush();

    expect(executed).toBe(0);
    await world.whenFlushed();
    expect(executed).toBe(1);
  });
});

// =============================================================================
// Inspection API
// =============================================================================

describe('World inspection', () => {
  it('getEntities returns all entity IDs', () => {
    const world = new World();
    const e1 = world.createEntity();
    const e2 = world.createEntity();
    const e3 = world.createEntity();

    const entities = world.getEntities();
    expect(entities).toContain(e1);
    expect(entities).toContain(e2);
    expect(entities).toContain(e3);
    expect(entities.length).toBe(3);
  });

  it('inspect returns entity snapshot', () => {
    const world = new World();
    const parent = world.createEntity();
    const child = world.createEntity(parent);

    world.add(parent, Position({ x: 10, y: 20 }));
    world.add(parent, Health({ value: 100 }));

    const snapshot = world.inspect(parent);

    expect(snapshot.id).toBe(parent);
    expect(snapshot.parent).toBeNull();
    expect(snapshot.children).toEqual([child]);
    expect(snapshot.components).toEqual({
      Position: { x: 10, y: 20 },
      Health: { value: 100 },
    });
  });

  it('inspect includes parent reference', () => {
    const world = new World();
    const parent = world.createEntity();
    const child = world.createEntity(parent);

    const snapshot = world.inspect(child);

    expect(snapshot.parent).toBe(parent);
    expect(snapshot.children).toEqual([]);
  });

  it('inspect throws for non-existent entity', () => {
    const world = new World();
    const entity = world.createEntity();
    world.removeEntity(entity);

    expect(() => world.inspect(entity)).toThrow(/does not exist/);
  });

  it('snapshot returns complete world state', () => {
    const world = new World();
    const e1 = world.createEntity();
    const e2 = world.createEntity(e1);

    world.add(e1, Position({ x: 0, y: 0 }));
    world.add(e2, Velocity({ x: 1, y: 1 }));

    world.registerSystem(
      defineReactiveSystem({
        name: 'TestSystem',
        query: Entities.with([Position, Velocity]),
        onEnter() {},
      }),
    );

    const snap = world.snapshot();

    expect(snap.stats.entityCount).toBe(2);
    expect(snap.stats.componentCount).toBe(2);
    expect(snap.stats.systemCount).toBe(1);

    expect(snap.entities.length).toBe(2);
    expect(snap.entities.find(e => e.id === e1)?.components).toEqual({
      Position: { x: 0, y: 0 },
    });
    expect(snap.entities.find(e => e.id === e2)?.components).toEqual({
      Velocity: { x: 1, y: 1 },
    });

    expect(snap.systems[0]?.name).toBe('TestSystem');
  });

  it('getSystems returns system info', () => {
    const world = new World();

    world.registerSystem(
      defineReactiveSystem({
        name: 'MovementSystem',
        query: Entities.with([Position, Velocity]),
        onUpdate() {},
      }),
    );

    world.registerSystem(
      defineReactiveSystem({
        query: Entities.with([Position]),
        onExit() {},
      }),
    );

    const systems = world.getSystems();

    expect(systems.length).toBe(2);

    expect(systems[0]?.name).toBe('MovementSystem');
    expect(systems[0]?.required).toEqual(['Position', 'Velocity']);
    expect(systems[0]?.excluded).toEqual([]);

    expect(systems[1]?.name).toBeUndefined();
    expect(systems[1]?.required).toEqual(['Position']);
    expect(systems[1]?.excluded).toEqual([]);
  });
});

// =============================================================================
// Mutation Tracking
// =============================================================================

describe('World mutation tracking', () => {
  it('notifies subscribers when components are added', () => {
    const world = new World();
    const entity = world.createEntity();
    const events: { type: string; componentTag: string }[] = [];

    world.onMutation(event => {
      events.push({ type: event.type, componentTag: event.componentTag });
    });

    world.add(entity, Position({ x: 1, y: 2 }));

    expect(events).toEqual([{ type: 'added', componentTag: 'Position' }]);
  });

  it('notifies subscribers when components are replaced', () => {
    const world = new World();
    const entity = world.createEntity();
    world.add(entity, Position({ x: 1, y: 2 }));

    const events: { type: string; data: unknown; previousData: unknown }[] = [];
    world.onMutation(event => {
      events.push({ type: event.type, data: event.data, previousData: event.previousData });
    });

    world.set(entity, Position({ x: 10, y: 20 }));

    expect(events).toEqual([
      { type: 'replaced', data: { x: 10, y: 20 }, previousData: { x: 1, y: 2 } },
    ]);
  });

  it('notifies subscribers when components are removed', () => {
    const world = new World();
    const entity = world.createEntity();
    world.add(entity, Position({ x: 1, y: 2 }));

    const events: { type: string; previousData: unknown }[] = [];
    world.onMutation(event => {
      events.push({ type: event.type, previousData: event.previousData });
    });

    world.remove(entity, Position);

    expect(events).toEqual([{ type: 'removed', previousData: { x: 1, y: 2 } }]);
  });

  it('notifies subscribers when entity is removed', () => {
    const world = new World();
    const entity = world.createEntity();
    world.add(entity, Position({ x: 1, y: 2 }));
    world.add(entity, Velocity({ x: 3, y: 4 }));

    const events: { entity: number; componentTag: string }[] = [];
    world.onMutation(event => {
      events.push({ entity: event.entity as number, componentTag: event.componentTag });
    });

    world.removeEntity(entity);

    expect(events).toContainEqual({ entity: entity as number, componentTag: 'Position' });
    expect(events).toContainEqual({ entity: entity as number, componentTag: 'Velocity' });
  });

  it('unsubscribes when returned function is called', () => {
    const world = new World();
    const entity = world.createEntity();
    const events: string[] = [];

    const unsubscribe = world.onMutation(event => {
      events.push(event.componentTag);
    });

    world.add(entity, Position({ x: 1, y: 2 }));
    expect(events).toEqual(['Position']);

    unsubscribe();

    world.add(entity, Velocity({ x: 3, y: 4 }));
    expect(events).toEqual(['Position']); // No new events
  });

  it('filters by specific entity', () => {
    const world = new World();
    const e1 = world.createEntity();
    const e2 = world.createEntity();
    const events: number[] = [];

    world.onMutation(
      event => {
        events.push(event.entity as number);
      },
      { entity: e1 },
    );

    world.add(e1, Position({ x: 1, y: 2 }));
    world.add(e2, Position({ x: 3, y: 4 }));

    expect(events).toEqual([e1 as number]);
  });

  it('filters by entity including descendants', () => {
    const world = new World();
    const parent = world.createEntity();
    const child = world.createEntity(parent);
    const grandchild = world.createEntity(child);
    const unrelated = world.createEntity();

    const events: number[] = [];
    world.onMutation(
      event => {
        events.push(event.entity as number);
      },
      { entity: parent, includeDescendants: true },
    );

    world.add(parent, Position({ x: 0, y: 0 }));
    world.add(child, Position({ x: 1, y: 1 }));
    world.add(grandchild, Position({ x: 2, y: 2 }));
    world.add(unrelated, Position({ x: 9, y: 9 }));

    expect(events).toEqual([parent as number, child as number, grandchild as number]);
  });

  it('filters by component types', () => {
    const world = new World();
    const entity = world.createEntity();
    const events: string[] = [];

    world.onMutation(
      event => {
        events.push(event.componentTag);
      },
      { components: [Position] },
    );

    world.add(entity, Position({ x: 1, y: 2 }));
    world.add(entity, Velocity({ x: 3, y: 4 }));
    world.add(entity, Health({ value: 100 }));

    expect(events).toEqual(['Position']);
  });

  it('combines entity and component filters', () => {
    const world = new World();
    const e1 = world.createEntity();
    const e2 = world.createEntity();
    const events: { entity: number; tag: string }[] = [];

    world.onMutation(
      event => {
        events.push({ entity: event.entity as number, tag: event.componentTag });
      },
      { entity: e1, components: [Position, Velocity] },
    );

    world.add(e1, Position({ x: 1, y: 2 }));
    world.add(e1, Health({ value: 100 })); // Filtered out (wrong component)
    world.add(e2, Position({ x: 3, y: 4 })); // Filtered out (wrong entity)
    world.add(e1, Velocity({ x: 5, y: 6 }));

    expect(events).toEqual([
      { entity: e1 as number, tag: 'Position' },
      { entity: e1 as number, tag: 'Velocity' },
    ]);
  });
});

// =============================================================================
// Debug Helpers
// =============================================================================

describe('World debug helpers', () => {
  it('debug systems capture mutations for debugged entities', () => {
    const world = new World();
    const buffer: DebugBuffer = { entries: [] };

    registerDebugSystems(world, { output: { type: 'buffer', buffer } });

    const entity = world.createEntity();
    world.add(entity, Debug({ label: 'Root' }));
    world.add(entity, Position({ x: 1, y: 2 }));

    const entry = buffer.entries.find(e => e.mutation.componentTag === 'Position');
    expect(entry?.entity).toBe(entity);
    expect(entry?.rootEntity).toBe(entity);
    expect(entry?.label).toBe('Root');
  });

  it('debug systems include descendants when DebugChildren is set', () => {
    const world = new World();
    const buffer: DebugBuffer = { entries: [] };

    registerDebugSystems(world, { output: { type: 'buffer', buffer } });

    const root = world.createEntity();
    const child = world.createEntity(root);
    world.add(root, Debug());
    world.add(root, DebugChildren());

    world.add(child, Position({ x: 5, y: 6 }));

    const entry = buffer.entries.find(
      e => e.entity === child && e.mutation.componentTag === 'Position',
    );
    expect(entry?.rootEntity).toBe(root);
  });

  it('debug systems can be disabled', () => {
    const world = new World();
    const buffer: DebugBuffer = { entries: [] };

    const handle = registerDebugSystems(world, { output: { type: 'buffer', buffer } });

    const entity = world.createEntity();
    world.add(entity, Debug());
    handle.disable();

    world.add(entity, Position({ x: 9, y: 9 }));

    const entry = buffer.entries.find(e => e.mutation.componentTag === 'Position');
    expect(entry).toBeUndefined();
  });

  it('debug returns a readable entity summary', () => {
    const logs: unknown[][] = [];
    const world = new World({
      externals: {
        console: {
          log: (...args: unknown[]) => {
            logs.push(args);
          },
        },
      },
    });
    const parent = world.createEntity();
    world.add(parent, Position({ x: 1, y: 2 }));

    const output = world.debug(parent);

    expect(output).toContain(`Entity ${parent}`);
    expect(output).toContain('Position');
    expect(logs.length).toBe(1);
    expect(String(logs[0]?.[0] ?? '')).toContain(`Entity ${parent}`);
  });

  it('debugTree returns a readable entity tree', () => {
    const logs: unknown[][] = [];
    const world = new World({
      externals: {
        console: {
          log: (...args: unknown[]) => {
            logs.push(args);
          },
        },
      },
    });
    const parent = world.createEntity();
    const child = world.createEntity(parent);

    world.add(parent, Position({ x: 0, y: 0 }));
    world.add(child, Velocity({ x: 1, y: 1 }));

    const output = world.debugTree(parent);

    expect(output).toContain(`Entity ${parent}`);
    expect(output).toContain(`Entity ${child}`);
    expect(output).toContain('Velocity');
    expect(logs.length).toBe(1);
    expect(String(logs[0]?.[0] ?? '')).toContain(`Entity ${parent}`);
  });
});

// =============================================================================
// Enhanced Errors
// =============================================================================

describe('World enhanced errors', () => {
  it('includes entity context for duplicate component errors', () => {
    const world = new World();
    const entity = world.createEntity();
    world.add(entity, Position({ x: 1, y: 2 }));

    let message = '';
    try {
      world.add(entity, Position({ x: 3, y: 4 }));
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('already exists');
    expect(message).toContain(`Entity ${entity}`);
    expect(message).toContain('Existing components');
  });

  it('wraps system errors with system name and entity info', () => {
    const world = new World({ autoFlush: false });
    const entity = world.createEntity();

    world.registerSystem(
      defineReactiveSystem({
        name: 'ExplodeSystem',
        query: Entities.with([Position]),
        onEnter() {
          throw new Error('boom');
        },
      }),
    );

    world.add(entity, Position({ x: 1, y: 2 }));

    let message = '';
    try {
      world.flush();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('Error in system "ExplodeSystem"');
    expect(message).toContain(`Entity ${entity}`);
    expect(message).toContain('Original error: boom');
  });
});

// =============================================================================
// Profiling
// =============================================================================

describe('World profiling', () => {
  it('records per-flush profiling data', () => {
    const world = new World({ autoFlush: false });
    const entity = world.createEntity();

    world.enableProfiling();
    world.registerSystem(
      defineReactiveSystem({
        name: 'ProfiledSystem',
        query: Entities.with([Position]),
        onEnter() {},
      }),
    );

    world.add(entity, Position({ x: 1, y: 2 }));
    world.flush();

    const profile = world.getLastFlushProfile();
    expect(profile).not.toBeNull();
    expect(profile?.mutationCount).toBe(1);
    expect(profile?.systemExecutions.length).toBe(1);
    expect(profile?.systemExecutions[0]?.name).toBe('ProfiledSystem');
  });

  it('tracks aggregate profiling stats', () => {
    const world = new World({ autoFlush: false });
    const entity = world.createEntity();

    world.enableProfiling();
    world.registerSystem(
      defineReactiveSystem({
        name: 'AggregateSystem',
        query: Entities.with([Position]),
        onEnter() {},
      }),
    );

    world.add(entity, Position({ x: 2, y: 3 }));
    world.flush();

    const stats = world.getProfilingStats();
    expect(stats.flushCount).toBe(1);
    const systemStats = stats.systemStats.get('AggregateSystem');
    expect(systemStats?.callCount).toBe(1);
    expect(systemStats?.totalDuration).toBeGreaterThanOrEqual(0);
  });
});
