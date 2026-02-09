import { describe, expect, it } from 'bun:test';
import { EntityName, getEntityName } from './entity-name.ts';
import { World } from './world.ts';

describe('EntityName', () => {
  it('creates name component', () => {
    const name = EntityName({ value: 'TestEntity' });
    expect(name._tag).toBe('EntityName');
    expect(name.data.value).toBe('TestEntity');
  });

  it('adds name to entity', () => {
    const world = new World();
    const entity = world.createEntity();

    world.add(entity, EntityName({ value: 'Player' }));

    const retrieved = world.get(entity, EntityName);
    expect(retrieved?.value).toBe('Player');
  });

  it('getEntityName returns name', () => {
    const world = new World();
    const entity = world.createEntity();

    world.add(entity, EntityName({ value: 'Enemy' }));

    expect(getEntityName(world, entity)).toBe('Enemy');
  });

  it('getEntityName returns undefined for unnamed entity', () => {
    const world = new World();
    const entity = world.createEntity();

    expect(getEntityName(world, entity)).toBeUndefined();
  });

  it('name appears in snapshot', () => {
    const world = new World();
    const entity = world.createEntity();

    world.add(entity, EntityName({ value: 'TestSnapshot' }));

    const snapshot = world.snapshot();
    const entitySnapshot = snapshot.entities.find(e => e.id === entity);

    expect(entitySnapshot?.name).toBe('TestSnapshot');
  });

  it('name appears in inspect', () => {
    const world = new World();
    const entity = world.createEntity();

    world.add(entity, EntityName({ value: 'TestInspect' }));

    const inspected = world.inspect(entity);

    expect(inspected?.name).toBe('TestInspect');
  });

  it('unnamed entity has undefined name in snapshot', () => {
    const world = new World();
    const entity = world.createEntity();

    const snapshot = world.snapshot();
    const entitySnapshot = snapshot.entities.find(e => e.id === entity);

    expect(entitySnapshot?.name).toBeUndefined();
  });
});
