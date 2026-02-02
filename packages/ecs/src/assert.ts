/**
 * Assertion helpers for runtime validation.
 * @module
 */

/**
 * Assert that a condition is truthy, throwing an error if not.
 *
 * @param condition - The condition to check. If falsy, an error is thrown.
 * @param message - The error message to include if the assertion fails.
 * @throws {Error} When the condition is falsy.
 *
 * @example
 * ```typescript
 * assert(entity !== undefined, 'Entity must exist');
 * // TypeScript now knows entity is defined
 * ```
 */
export function assert(condition: unknown, message: string): asserts condition {
  if (condition) return;
  throw new Error(message);
}
