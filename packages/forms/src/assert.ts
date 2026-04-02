// @minimap summary: Provides the small dependency-free assertion helper used by the forms package for internal invariants.
// @minimap tags: forms assert invariant helper validation
/**
 * Assertion helper for forms package (dependency-free).
 */

export function assert(condition: unknown, message: string): asserts condition {
  if (condition) return;
  throw new Error(message);
}
