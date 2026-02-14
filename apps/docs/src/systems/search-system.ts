/**
 * SearchSystem — fetches search index, filters results, renders them.
 */

import { Classes, DOMElement, getDOMElement } from '@ecs-test/dom';
import { defineReactiveSystem, Entities, type EntityId, type World } from '@ecs-test/ecs';
import {
  type SearchEntry,
  SearchIndex,
  SearchInput,
  SearchQuery,
  SearchResultItem,
  SearchResults,
} from '../components.ts';

/** Handles input events on the search field */
export const SearchInputSystem = defineReactiveSystem({
  name: 'SearchInputSystem',
  query: Entities.with([SearchInput]),
  onEnter(world, entities) {
    for (const entity of entities) {
      const el = getDOMElement(world, entity) as HTMLInputElement | null;
      if (!el) continue;

      el.type = 'search';
      el.placeholder = 'Search docs';
      el.autocomplete = 'off';
      el.spellcheck = false;

      const query = world.get(entity, SearchQuery);
      if (query) {
        el.value = query.value;
      }

      el.addEventListener('input', () => {
        world.set(entity, SearchQuery({ value: el.value }));
        world.flush();
      });
    }
  },
});

/** Filters search index when query changes, creates/removes result entities */
export const SearchFilterSystem = defineReactiveSystem({
  name: 'SearchFilterSystem',
  query: Entities.with([SearchQuery]),
  onEnter: filterResults,
  onUpdate: filterResults,
});

function filterResults(world: World, entities: EntityId[]) {
  for (const entity of entities) {
    const query = world.get(entity, SearchQuery);
    if (!query) continue;

    const resultsEntities = world.query(SearchResults);
    if (resultsEntities.length === 0) continue;
    const resultsEntity = resultsEntities[0];
    if (!resultsEntity) continue;

    for (const child of world.getChildren(resultsEntity)) {
      if (world.has(child, SearchResultItem)) {
        world.removeEntity(child);
      }
    }

    const term = query.value.trim().toLowerCase();
    if (!term) continue;

    const indexEntities = world.query(SearchIndex);
    if (indexEntities.length === 0) continue;
    const indexEntity = indexEntities[0];
    if (!indexEntity) continue;
    const index = world.get(indexEntity, SearchIndex);
    if (!index) continue;

    const matches = index.entries.filter(
      (e: SearchEntry) =>
        e.title.toLowerCase().includes(term) ||
        e.description.toLowerCase().includes(term) ||
        e.text.toLowerCase().includes(term),
    );

    for (const match of matches.slice(0, 10)) {
      const resultEntity = world.createEntity(resultsEntity);
      world.add(resultEntity, DOMElement({ tag: 'a' }));
      world.add(
        resultEntity,
        SearchResultItem({
          title: match.title,
          slug: match.slug,
          description: match.description,
        }),
      );
      world.add(resultEntity, Classes({ list: ['search-result-item'] }));
    }
  }
}

/** Renders search result items into DOM */
export const SearchResultRenderSystem = defineReactiveSystem({
  name: 'SearchResultRenderSystem',
  query: Entities.with([SearchResultItem]),
  onEnter(world, entities) {
    for (const entity of entities) {
      const el = getDOMElement(world, entity) as HTMLAnchorElement | null;
      const data = world.get(entity, SearchResultItem);
      if (!el || !data) continue;

      el.href = `/${data.slug}.html`;
      el.innerHTML = `<span class="search-result-title">${escapeHtml(data.title)}</span><span class="search-result-desc">${escapeHtml(data.description)}</span>`;
    }
  },
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
