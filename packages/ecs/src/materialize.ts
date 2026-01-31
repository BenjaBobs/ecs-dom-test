/**
 * Materializes JSX trees into ECS entities.
 */

import type { World, EntityId } from './world.ts';
import type { ComponentInstance } from './component.ts';
import type { JSXChild, JSXEntity } from './jsx-runtime.ts';
import { isJSXEntity, isBundle } from './jsx-runtime.ts';
import { assert } from './assert.ts';

/**
 * Materialize a JSX tree into entities in the world.
 * Returns the root entity ID (or array of IDs if multiple roots).
 */
export function materialize(
  world: World,
  jsx: JSXChild,
  parent?: EntityId,
): EntityId | EntityId[] | undefined {
  // Handle null/undefined
  if (jsx == null) {
    return undefined;
  }

  // Handle arrays (fragments, multiple children)
  if (Array.isArray(jsx)) {
    const ids: EntityId[] = [];
    for (const child of jsx) {
      const result = materialize(world, child, parent);
      if (result !== undefined) {
        if (Array.isArray(result)) {
          ids.push(...result);
        } else {
          ids.push(result);
        }
      }
    }
    return ids.length > 0 ? ids : undefined;
  }

  // Handle entity nodes
  if (isJSXEntity(jsx)) {
    return materializeEntity(world, jsx, parent);
  }

  // Handle component instances - add to parent entity
  if (isComponentInstance(jsx)) {
    assert(parent !== undefined, 'Component must be inside an <Entity>');
    world.add(parent, jsx);
    return undefined;
  }

  // Handle bundles - add all components to parent entity
  if (isBundle(jsx)) {
    assert(parent !== undefined, 'Bundle must be inside an <Entity>');
    for (const component of jsx.components) {
      world.add(parent, component);
    }
    return undefined;
  }

  // Handle primitives (strings, numbers) - could create text entities
  if (typeof jsx === 'string' || typeof jsx === 'number') {
    console.warn('Primitive children not yet implemented:', jsx);
    return undefined;
  }

  throw new Error(`Unknown JSX child type: ${typeof jsx}`);
}

function materializeEntity(world: World, entity: JSXEntity, parent?: EntityId): EntityId {
  const entityId = world.createEntity(parent);

  // Two-pass materialization:
  // Pass 1: Add components and bundles to this entity first
  // This ensures DOMElement exists before child entities try to attach
  for (const child of entity.children) {
    if (isComponentInstance(child) || isBundle(child)) {
      materialize(world, child, entityId);
    }
  }

  // Pass 2: Create child entities (and handle arrays/primitives)
  for (const child of entity.children) {
    if (!isComponentInstance(child) && !isBundle(child)) {
      materialize(world, child, entityId);
    }
  }

  return entityId;
}

function isComponentInstance(value: unknown): value is ComponentInstance {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_tag' in value &&
    'data' in value &&
    !('_isEntity' in value) &&
    !('_isBundle' in value)
  );
}
