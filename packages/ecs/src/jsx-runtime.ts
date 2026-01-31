/**
 * JSX Runtime for ECS UI framework.
 *
 * JSX produces a declarative tree that gets materialized into ECS entities.
 */

import type { ComponentInstance } from './component.ts';
import type { BundleResult } from './bundle.ts';
import { isBundle } from './bundle.ts';

// =============================================================================
// Types
// =============================================================================

/** JSX can produce entities, components, or bundles */
export type JSXChild =
  | JSXEntity
  | ComponentInstance
  | BundleResult
  | string
  | number
  | null
  | undefined
  | JSXChild[];

/** An entity node in the JSX tree */
export type JSXEntity = {
  _isEntity: true;
  children: JSXChild[];
};

type JSXElementType =
  | typeof Fragment
  | typeof Entity
  | ((props: Record<string, unknown>) => ComponentInstance | BundleResult);

// =============================================================================
// JSX Elements
// =============================================================================

/** Fragment symbol for grouping without a wrapper */
export const Fragment = Symbol.for('ecs.fragment');

/** Entity marker component for JSX */
export function Entity(_props: { children?: JSXChild | JSXChild[] }): JSXEntity {
  return { _isEntity: true, children: [] };
}

// =============================================================================
// JSX Factory Functions
// =============================================================================

/**
 * JSX factory function.
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

/** JSX factory for multiple children */
export const jsxs = jsx;

/** JSX factory for dev mode */
export const jsxDEV = jsx;

// =============================================================================
// Helpers
// =============================================================================

function normalizeChildren(children: unknown): JSXChild[] {
  if (children == null) return [];
  if (Array.isArray(children)) return children.flatMap(normalizeChildren);
  return [children as JSXChild];
}

/** Check if a value is a JSX entity */
export function isJSXEntity(value: unknown): value is JSXEntity {
  return (
    typeof value === 'object' && value !== null && '_isEntity' in value && value._isEntity === true
  );
}

// Re-export isBundle for materialize
export { isBundle };
