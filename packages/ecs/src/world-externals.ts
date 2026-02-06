/**
 * World external dependencies interface.
 *
 * This interface is intentionally empty and meant to be extended via
 * module augmentation. Packages can add their required externals here.
 *
 * @example
 * ```typescript
 * // In @ecs-test/dom
 * declare module '@ecs-test/ecs' {
 *   interface WorldExternals {
 *     createElement: (tag: string) => Element;
 *     console: { log: (...args: unknown[]) => void };
 *   }
 * }
 * ```
 *
 * @module
 */

export interface WorldExternals {
  console?: { log: (...args: unknown[]) => void };
}
