import { describe, expect, it } from 'bun:test';
import { defineComponent, defineMarker } from './component.ts';
import {
  added,
  addedOrReplaced,
  defineReactiveSystem,
  type Mutation,
  removed,
  replaced,
} from './system.ts';
import { World } from './world.ts';

const Position = defineComponent<{ x: number; y: number }>('Position');
const Velocity = defineComponent<{ x: number; y: number }>('Velocity');
const Selected = defineMarker('Selected');

describe('trigger helpers', () => {
  it('added creates correct trigger', () => {
    const trigger = added(Position);

    expect(trigger.componentTag).toBe('Position');
    expect(trigger.mutationType).toBe('added');
  });

  it('removed creates correct trigger', () => {
    const trigger = removed(Position);

    expect(trigger.componentTag).toBe('Position');
    expect(trigger.mutationType).toBe('removed');
  });

  it('replaced creates correct trigger', () => {
    const trigger = replaced(Position);

    expect(trigger.componentTag).toBe('Position');
    expect(trigger.mutationType).toBe('replaced');
  });

  it('addedOrReplaced creates correct trigger', () => {
    const trigger = addedOrReplaced(Position);

    expect(trigger.componentTag).toBe('Position');
    expect(trigger.mutationType).toBe('addedOrReplaced');
  });
});

describe('ReactiveSystem.matches', () => {
  it('matches when trigger matches mutation', () => {
    const world = new World({ autoFlush: false });
    const entity = world.createEntity();
    world.add(entity, Position({ x: 0, y: 0 }));

    const system = defineReactiveSystem({
      triggers: [added(Position)],
      execute() {},
    });

    const mutation: Mutation = {
      entity,
      componentTag: 'Position',
      type: 'added',
    };

    expect(system.matches(mutation, world)).toBe(true);
  });

  it('does not match when component tag differs', () => {
    const world = new World({ autoFlush: false });
    const entity = world.createEntity();

    const system = defineReactiveSystem({
      triggers: [added(Position)],
      execute() {},
    });

    const mutation: Mutation = {
      entity,
      componentTag: 'Velocity',
      type: 'added',
    };

    expect(system.matches(mutation, world)).toBe(false);
  });

  it('does not match when mutation type differs', () => {
    const world = new World({ autoFlush: false });
    const entity = world.createEntity();

    const system = defineReactiveSystem({
      triggers: [added(Position)],
      execute() {},
    });

    const mutation: Mutation = {
      entity,
      componentTag: 'Position',
      type: 'removed',
    };

    expect(system.matches(mutation, world)).toBe(false);
  });

  it('addedOrReplaced matches added mutations', () => {
    const world = new World({ autoFlush: false });
    const entity = world.createEntity();
    world.add(entity, Position({ x: 0, y: 0 }));

    const system = defineReactiveSystem({
      triggers: [addedOrReplaced(Position)],
      execute() {},
    });

    const mutation: Mutation = {
      entity,
      componentTag: 'Position',
      type: 'added',
    };

    expect(system.matches(mutation, world)).toBe(true);
  });

  it('addedOrReplaced matches replaced mutations', () => {
    const world = new World({ autoFlush: false });
    const entity = world.createEntity();
    world.add(entity, Position({ x: 0, y: 0 }));

    const system = defineReactiveSystem({
      triggers: [addedOrReplaced(Position)],
      execute() {},
    });

    const mutation: Mutation = {
      entity,
      componentTag: 'Position',
      type: 'replaced',
    };

    expect(system.matches(mutation, world)).toBe(true);
  });

  it('addedOrReplaced does not match removed mutations', () => {
    const world = new World({ autoFlush: false });
    const entity = world.createEntity();

    const system = defineReactiveSystem({
      triggers: [addedOrReplaced(Position)],
      execute() {},
    });

    const mutation: Mutation = {
      entity,
      componentTag: 'Position',
      type: 'removed',
    };

    expect(system.matches(mutation, world)).toBe(false);
  });

  it('matches any of multiple triggers', () => {
    const world = new World({ autoFlush: false });
    const entity = world.createEntity();
    world.add(entity, Position({ x: 0, y: 0 }));

    const system = defineReactiveSystem({
      triggers: [added(Position), added(Velocity)],
      execute() {},
    });

    const positionMutation: Mutation = {
      entity,
      componentTag: 'Position',
      type: 'added',
    };

    const velocityMutation: Mutation = {
      entity,
      componentTag: 'Velocity',
      type: 'added',
    };

    expect(system.matches(positionMutation, world)).toBe(true);
    expect(system.matches(velocityMutation, world)).toBe(true);
  });
});

describe('ReactiveSystem.matches with filter', () => {
  it('matches when entity has all filter components', () => {
    const world = new World({ autoFlush: false });
    const entity = world.createEntity();
    world.add(entity, Position({ x: 0, y: 0 }));
    world.add(entity, Selected());

    const system = defineReactiveSystem({
      triggers: [added(Position)],
      filter: [Selected],
      execute() {},
    });

    const mutation: Mutation = {
      entity,
      componentTag: 'Position',
      type: 'added',
    };

    expect(system.matches(mutation, world)).toBe(true);
  });

  it('does not match when entity missing filter component', () => {
    const world = new World({ autoFlush: false });
    const entity = world.createEntity();
    world.add(entity, Position({ x: 0, y: 0 }));
    // Note: Selected not added

    const system = defineReactiveSystem({
      triggers: [added(Position)],
      filter: [Selected],
      execute() {},
    });

    const mutation: Mutation = {
      entity,
      componentTag: 'Position',
      type: 'added',
    };

    expect(system.matches(mutation, world)).toBe(false);
  });

  it('requires all filter components to be present', () => {
    const world = new World({ autoFlush: false });
    const entity = world.createEntity();
    world.add(entity, Position({ x: 0, y: 0 }));
    world.add(entity, Selected());
    // Note: Velocity not added

    const system = defineReactiveSystem({
      triggers: [added(Position)],
      filter: [Selected, Velocity],
      execute() {},
    });

    const mutation: Mutation = {
      entity,
      componentTag: 'Position',
      type: 'added',
    };

    expect(system.matches(mutation, world)).toBe(false);
  });
});

describe('defineReactiveSystem', () => {
  it('creates a system that can be registered', () => {
    const world = new World({ autoFlush: false });
    let executedWith: number[] = [];

    const system = defineReactiveSystem({
      triggers: [added(Position)],
      execute(entities) {
        executedWith = [...entities];
      },
    });

    world.registerSystem(system);

    const entity = world.createEntity();
    world.add(entity, Position({ x: 0, y: 0 }));
    world.flush();

    expect(executedWith).toContain(entity);
  });
});
