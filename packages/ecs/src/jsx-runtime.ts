/**
 * JSX Runtime for ECS UI framework.
 *
 * This module provides the JSX factory functions that transform JSX syntax
 * into a declarative tree structure, which can then be materialized into
 * ECS entities.
 *
 * @module
 */

import type { BundleResult } from './bundle.ts';
import { isBundle } from './bundle.ts';
import type { ComponentInstance } from './component.ts';

// =============================================================================
// Types
// =============================================================================

/**
 * Valid children in JSX expressions.
 * Can be entities, components, bundles, primitives, or arrays of these.
 */
export type JSXChild =
  | JSXEntity
  | ComponentInstance
  | BundleResult
  | string
  | number
  | null
  | undefined
  | JSXChild[];

/**
 * An entity node in the JSX tree.
 * Created by `<Entity>` elements and materialized into world entities.
 */
export type JSXEntity = {
  /** Marker to identify entity nodes */
  _isEntity: true;
  /** Child elements (components, bundles, nested entities) */
  children: JSXChild[];
};

/** Valid JSX element types */
type JSXElementType =
  | typeof Fragment
  | typeof Entity
  | ((props: Record<string, unknown>) => ComponentInstance | BundleResult);

// =============================================================================
// JSX Elements
// =============================================================================

/**
 * Fragment symbol for grouping children without creating a wrapper entity.
 *
 * @example
 * ```tsx
 * <>
 *   <Entity>...</Entity>
 *   <Entity>...</Entity>
 * </>
 * ```
 */
export const Fragment = Symbol.for('ecs.fragment');

/**
 * Entity element for creating ECS entities in JSX.
 * Used internally by the JSX factory - prefer using `<Entity>` syntax.
 *
 * @param _props - Props including children
 * @returns A JSXEntity node
 */
export function Entity(_props: { children?: JSXChild | JSXChild[] }): JSXEntity {
  return { _isEntity: true, children: [] };
}

// =============================================================================
// JSX Factory Functions
// =============================================================================

/**
 * JSX factory function - transforms JSX elements into JSXChild nodes.
 * This is called automatically by the JSX compiler.
 *
 * @param type - The element type (Fragment, Entity, or component function)
 * @param props - Props passed to the element
 * @returns The resulting JSXChild
 * @throws {Error} If the element type is not recognized
 */
export function jsx(
  type: JSXElementType,
  props: Record<string, unknown> & { children?: JSXChild },
): JSXChild {
  const { children, ...rest } = props;
  const childArray = normalizeChildren(children);

  // Fragment - just return children
  if (type === Fragment) {
    return childArray;
  }

  // Entity element
  if (type === Entity) {
    return {
      _isEntity: true,
      children: childArray,
    };
  }

  // Component or Bundle function
  if (typeof type === 'function') {
    return type(rest);
  }

  throw new Error(`Unknown JSX element type: ${String(type)}`);
}

/** JSX factory for elements with multiple children */
export const jsxs = jsx;

/** JSX factory for development mode (same as jsx) */
export const jsxDEV = jsx;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Normalize children into a flat array.
 * Handles null, undefined, and nested arrays.
 */
function normalizeChildren(children: unknown): JSXChild[] {
  if (children == null) return [];
  if (Array.isArray(children)) return children.flatMap(normalizeChildren);
  return [children as JSXChild];
}

/**
 * Check if a value is a JSX entity node.
 *
 * @param value - The value to check
 * @returns True if the value is a JSXEntity
 */
export function isJSXEntity(value: unknown): value is JSXEntity {
  return (
    typeof value === 'object' && value != null && '_isEntity' in value && value._isEntity === true
  );
}

// Re-export isBundle for materialize
export { isBundle };
