/**
 * Materializes JSX trees into ECS entities.
 *
 * This module bridges the declarative JSX syntax with the imperative
 * ECS world API, creating entities and adding components as specified
 * in the JSX tree.
 *
 * @module
 */

import { assert } from './assert.ts';
import type { ComponentInstance } from './component.ts';
import type { JSXChild, JSXEntity } from './jsx-runtime.ts';
import { isBundle, isJSXEntity } from './jsx-runtime.ts';
import type { EntityId, World } from './world.ts';

/**
 * Materialize a JSX tree into entities in the world.
 *
 * Recursively processes JSX nodes, creating entities and adding components
 * as appropriate. Uses a two-pass approach to ensure parent components
 * exist before child entities are created.
 *
 * @param world - The world to create entities in
 * @param jsx - The JSX tree to materialize
 * @param parent - Optional parent entity for the created entities
 * @returns The root entity ID, array of IDs if multiple roots, or undefined if no entities created
 *
 * @example
 * ```typescript
 * const entityId = materialize(world, (
 *   <Entity>
 *     <Position x={0} y={0} />
 *     <Velocity x={1} y={1} />
 *   </Entity>
 * ));
 * ```
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

  // Handle primitives (strings, numbers)
  if (typeof jsx === 'string' || typeof jsx === 'number') {
    // Primitive children are not supported - they would need a text component
    // to be meaningful, which is application-specific
    console.warn('Primitive children not supported in JSX:', jsx);
    return undefined;
  }

  throw new Error(`Unknown JSX child type: ${typeof jsx}`);
}

/**
 * Materialize an entity node and its children.
 * Uses two-pass approach: components first, then child entities.
 */
function materializeEntity(world: World, entity: JSXEntity, parent?: EntityId): EntityId {
  const entityId = world.createEntity(parent);

  // Two-pass materialization:
  // Pass 1: Add components and bundles to this entity first
  // This ensures the entity is fully formed before child entities try to attach
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

/**
 * Check if a value is a component instance.
 * Distinguishes from entities and bundles by checking markers.
 */
function isComponentInstance(value: unknown): value is ComponentInstance {
  return (
    typeof value === 'object' &&
    value != null &&
    '_tag' in value &&
    'data' in value &&
    !('_isEntity' in value) &&
    !('_isBundle' in value)
  );
}
