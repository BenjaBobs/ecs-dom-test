import { describe, expect, it } from 'bun:test';
import { defineComponent, defineMarker } from './component.ts';
import { defineReactiveSystem, Entities } from './system.ts';
import { World } from './world.ts';

const Position = defineComponent<{ x: number; y: number }>('Position');
const Velocity = defineComponent<{ x: number; y: number }>('Velocity');
const Selected = defineMarker('Selected');

describe('query helpers', () => {
  it('canonicalizes required component order', () => {
    const q1 = Entities.with([Position, Velocity]);
    const q2 = Entities.with([Velocity, Position]);

    expect(q1.required).toEqual(q2.required);
    expect(q1.excluded).toEqual(q2.excluded);
  });

  it('supports without exclusions', () => {
    const q = Entities.with([Position]).without([Selected]);

    expect(q.required).toEqual(['Position']);
    expect(q.excluded).toEqual(['Selected']);
  });

  it('supports without-only queries', () => {
    const q = Entities.without([Selected]);

    expect(q.required).toEqual([]);
    expect(q.excluded).toEqual(['Selected']);
  });
});

describe('ReactiveSystem.matchesEntity', () => {
  it('matches when required components are present', () => {
    const world = new World({ autoFlush: false });
    const entity = world.createEntity();
    world.add(entity, Position({ x: 0, y: 0 }));

    const system = defineReactiveSystem({
      query: Entities.with([Position]),
      onEnter() {},
    });

    expect(system.matchesEntity(world, entity)).toBe(true);
  });

  it('does not match when excluded component is present', () => {
    const world = new World({ autoFlush: false });
    const entity = world.createEntity();
    world.add(entity, Position({ x: 0, y: 0 }));
    world.add(entity, Selected());

    const system = defineReactiveSystem({
      query: Entities.with([Position]).without([Selected]),
      onEnter() {},
    });

    expect(system.matchesEntity(world, entity)).toBe(false);
  });
});

describe('defineReactiveSystem', () => {
  it('can be registered and runs onEnter', () => {
    const world = new World({ autoFlush: false });
    const entered: number[] = [];

    const system = defineReactiveSystem({
      query: Entities.with([Position]),
      onEnter(_world, entities) {
        entered.push(...entities);
      },
    });

    world.registerSystem(system);

    const entity = world.createEntity();
    world.add(entity, Position({ x: 0, y: 0 }));
    world.flush();

    expect(entered).toContain(entity);
  });
});
