/**
 * Shared path-to-root state, set once at boot from page data.
 * e.g. "./" for root pages, "../" for depth-1 pages, "../../" for depth-2, etc.
 */
export let pathToRoot = './';

export function setPathToRoot(value: string): void {
  pathToRoot = value;
}
