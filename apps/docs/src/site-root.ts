// @minimap summary: Stores the current docs page path-to-root prefix so runtime systems can build correct relative links across nested routes.
// @minimap tags: docs routing path root links relative navigation
/**
 * Shared path-to-root state, set once at boot from page data.
 * e.g. "./" for root pages, "../" for depth-1 pages, "../../" for depth-2, etc.
 */
export let pathToRoot = './';

export function setPathToRoot(value: string): void {
  pathToRoot = value;
}
