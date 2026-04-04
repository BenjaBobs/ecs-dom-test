// @minimap summary: Defines the ECS components and markers that hold docs app state for content rendering, navigation, search, and theme UI.
// @minimap tags: docs components markers search navigation theme content ecs
/**
 * ECS components for the docs site client app.
 */

import { defineComponent, defineMarker } from '@ecs-test/ecs';

/** Injects innerHTML into the entity's DOM element */
export const HtmlContent = defineComponent<{ html: string }>('HtmlContent');

/** Current theme mode */
export const ThemeState = defineComponent<{ mode: 'light' | 'dark' }>('ThemeState');

/** Marks the theme toggle button entity */
export const ThemeToggle = defineMarker('ThemeToggle');

/** Loaded search index data */
export type SearchEntry = {
  title: string;
  slug: string;
  description: string;
  text: string;
};
export const SearchIndex = defineComponent<{ entries: SearchEntry[] }>('SearchIndex');

/** Current search input value */
export const SearchQuery = defineComponent<{ value: string }>('SearchQuery');

/** One search result */
export const SearchResultItem = defineComponent<{
  title: string;
  slug: string;
  description: string;
}>('SearchResultItem');

/** Marks the search results container */
export const SearchResults = defineMarker('SearchResults');

/** Sidebar nav item data */
export const NavItemData = defineComponent<{
  title: string;
  slug: string;
  isActive: boolean;
}>('NavItemData');

/** Sidebar group header */
export const NavGroup = defineComponent<{ title: string }>('NavGroup');

/** Prev/next link targets for bottom navigation */
export const BottomNavData = defineComponent<{
  prev?: { title: string; slug: string };
  next?: { title: string; slug: string };
}>('BottomNavData');
