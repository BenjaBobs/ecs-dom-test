import { describe, expect, it } from 'bun:test';
import {
  added,
  addedOrReplaced,
  createMicrotaskScheduler,
  defineComponent,
  defineMarker,
  defineReactiveSystem,
  removed,
  World,
} from './index.ts';

const Position = defineComponent<{ x: number; y: number }>('Position');
const Velocity = defineComponent<{ x: number; y: number }>('Velocity');
const Selected = defineMarker('Selected');

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

  it('runs reactive systems with triggers and filters', () => {
    const world = new World();
    const entity = world.createEntity();
    let executed = 0;

    world.registerSystem(
      defineReactiveSystem({
        triggers: [added(Position)],
        filter: [Selected],
        execute(entities) {
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
    const world = new World();
    const entity = world.createEntity();
    let executions = 0;

    world.registerSystem(
      defineReactiveSystem({
        triggers: [addedOrReplaced(Position)],
        execute(entities) {
          executions += entities.length;
        },
      }),
    );

    world.add(entity, Position({ x: 0, y: 0 }));
    world.set(entity, Position({ x: 1, y: 1 }));
    world.flush();

    expect(executions).toBe(1);
  });

  it('supports removed triggers', () => {
    const world = new World();
    const entity = world.createEntity();
    let removedCount = 0;

    world.registerSystem(
      defineReactiveSystem({
        triggers: [removed(Position)],
        execute(entities) {
          removedCount += entities.length;
        },
      }),
    );

    world.add(entity, Position({ x: 2, y: 3 }));
    world.remove(entity, Position);
    world.flush();

    expect(removedCount).toBe(1);
  });

  it('schedules async flushes and can await completion', async () => {
    const world = new World({
      scheduler: createMicrotaskScheduler(callback => Promise.resolve().then(callback)),
    });
    const entity = world.createEntity();
    let executed = 0;

    world.registerSystem(
      defineReactiveSystem({
        triggers: [added(Position)],
        execute(entities) {
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
