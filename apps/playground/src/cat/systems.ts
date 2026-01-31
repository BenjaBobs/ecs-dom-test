/**
 * Cat fetcher systems.
 */

import {
  type World,
  type EntityId,
  type ComponentRef,
  defineReactiveSystem,
  added,
  addedOrReplaced,
  removed,
} from '@ecs-test/ecs';
import { DOMElement, TextContent, Classes, Clicked, Disabled, getDOMElement } from '@ecs-test/dom';
import {
  FetchCat,
  Loading,
  CatData,
  FetchError,
  ImageSrc,
  FetchCatButton,
  CatDisplayMarker,
} from './components.ts';

/**
 * Handles FetchCatButton clicks - adds FetchCat to parent CatDisplay.
 */
const FetchCatButtonClickSystem = defineReactiveSystem({
  triggers: [added(Clicked)],
  filter: [FetchCatButton],
  execute(entities, world) {
    for (const entity of entities) {
      const catDisplay = findAncestorWithComponent(entity, CatDisplayMarker, world);
      if (catDisplay !== undefined) {
        if (!world.has(catDisplay, Loading)) {
          world.set(catDisplay, FetchCat());
        }
      }
      world.remove(entity, Clicked);
    }
  },
});

/**
 * Handles FetchCat trigger - starts async fetch for cat data.
 */
const FetchCatSystem = defineReactiveSystem({
  triggers: [added(FetchCat)],
  execute(entities, world) {
    for (const entity of entities) {
      world.remove(entity, FetchCat);
      world.set(entity, Loading());
      world.remove(entity, FetchError);

      fetch('https://cataas.com/cat?json=true')
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(data => {
          console.log('Cat API response:', data);
          const catId = data._id ?? data.id ?? data.url?.split('/').pop();
          if (!catId) {
            const fallbackId = `random-${Date.now()}`;
            world.remove(entity, Loading);
            world.set(entity, CatData({ id: fallbackId, tags: [] }));
            world.flush();
            return;
          }
          world.remove(entity, Loading);
          world.set(entity, CatData({ id: catId, tags: data.tags ?? [] }));
          world.flush();
        })
        .catch((err: Error) => {
          world.remove(entity, Loading);
          world.set(entity, FetchError({ message: err.message }));
          world.flush();
        });
    }
  },
});

/**
 * Creates/updates image element when CatData arrives.
 */
const CatImageRenderSystem = defineReactiveSystem({
  triggers: [addedOrReplaced(CatData)],
  execute(entities, world) {
    for (const entity of entities) {
      const catData = world.get(entity, CatData);
      if (!catData) continue;

      const imgUrl = catData.id.startsWith('random-')
        ? `https://cataas.com/cat?${catData.id}`
        : `https://cataas.com/cat/${catData.id}`;

      let imgEntity = findChildWithComponent(entity, ImageSrc, world);

      if (imgEntity === undefined) {
        imgEntity = world.createEntity(entity);
        world.add(imgEntity, DOMElement({ tag: 'img' }));
        world.add(imgEntity, Classes({ list: ['cat-image'] }));
      }

      world.set(imgEntity, ImageSrc({ url: imgUrl }));
    }
  },
});

/**
 * Applies ImageSrc to the DOM img element.
 */
const ImageSrcSystem = defineReactiveSystem({
  triggers: [addedOrReplaced(ImageSrc)],
  execute(entities, world) {
    for (const entity of entities) {
      const src = world.get(entity, ImageSrc);
      const el = getDOMElement(world, entity);

      if (src && el && el.tagName === 'IMG') {
        (el as HTMLImageElement).src = src.url;
      }
    }
  },
});

/**
 * Shows loading indicator when Loading is added.
 */
const LoadingRenderSystem = defineReactiveSystem({
  triggers: [added(Loading)],
  execute(entities, world) {
    for (const entity of entities) {
      let loadingEntity = findChildWithComponent(entity, 'LoadingIndicator', world);

      if (loadingEntity === undefined) {
        loadingEntity = world.createEntity(entity);
        world.add(loadingEntity, DOMElement({ tag: 'span' }));
        world.add(loadingEntity, { _tag: 'LoadingIndicator', data: undefined });
      }

      world.set(loadingEntity, TextContent({ value: 'Loading...' }));
      world.set(loadingEntity, Classes({ list: ['loading'] }));
    }
  },
});

/**
 * Removes loading indicator when data or error arrives.
 */
const LoadingRemoveSystem = defineReactiveSystem({
  triggers: [addedOrReplaced(CatData), addedOrReplaced(FetchError)],
  execute(entities, world) {
    for (const entity of entities) {
      const loadingEntity = findChildWithComponent(entity, 'LoadingIndicator', world);
      if (loadingEntity !== undefined) {
        world.removeEntity(loadingEntity);
      }
    }
  },
});

/**
 * Renders error message when FetchError is added.
 */
const ErrorRenderSystem = defineReactiveSystem({
  triggers: [added(FetchError)],
  execute(entities, world) {
    for (const entity of entities) {
      const error = world.get(entity, FetchError);
      if (!error) continue;

      let errorEntity = findChildWithComponent(entity, 'ErrorIndicator', world);

      if (errorEntity === undefined) {
        errorEntity = world.createEntity(entity);
        world.add(errorEntity, DOMElement({ tag: 'span' }));
        world.add(errorEntity, { _tag: 'ErrorIndicator', data: undefined });
      }

      world.set(errorEntity, TextContent({ value: `Error: ${error.message}` }));
      world.set(errorEntity, Classes({ list: ['error'] }));
    }
  },
});

/**
 * Disables fetch button when loading starts.
 */
const ButtonDisableOnLoadSystem = defineReactiveSystem({
  triggers: [added(Loading)],
  filter: [CatDisplayMarker],
  execute(entities, world) {
    for (const entity of entities) {
      const button = findChildWithComponent(entity, FetchCatButton, world);
      if (button !== undefined) {
        world.set(button, Disabled());
        const el = getDOMElement(world, button);
        if (el && el instanceof HTMLButtonElement) {
          el.disabled = true;
        }
      }
    }
  },
});

/**
 * Re-enables fetch button when loading ends.
 */
const ButtonEnableOnLoadEndSystem = defineReactiveSystem({
  triggers: [removed(Loading)],
  execute(entities, world) {
    for (const entity of entities) {
      if (!world.has(entity, CatDisplayMarker)) continue;

      const button = findChildWithComponent(entity, FetchCatButton, world);
      if (button !== undefined) {
        world.remove(button, Disabled);
        const el = getDOMElement(world, button);
        if (el && el instanceof HTMLButtonElement) {
          el.disabled = false;
        }
      }
    }
  },
});

/**
 * Register all cat-related systems with the world.
 */
export function registerCatSystems(world: World): void {
  world.registerSystem(FetchCatButtonClickSystem);
  world.registerSystem(FetchCatSystem);
  world.registerSystem(CatImageRenderSystem);
  world.registerSystem(ImageSrcSystem);
  world.registerSystem(LoadingRenderSystem);
  world.registerSystem(LoadingRemoveSystem);
  world.registerSystem(ErrorRenderSystem);
  world.registerSystem(ButtonDisableOnLoadSystem);
  world.registerSystem(ButtonEnableOnLoadEndSystem);
}

// =============================================================================
// Helpers
// =============================================================================

function findChildWithComponent(
  entity: EntityId,
  component: ComponentRef,
  world: World,
): EntityId | undefined {
  for (const child of world.getChildren(entity)) {
    if (world.has(child, component)) {
      return child;
    }
  }
  return undefined;
}

function findAncestorWithComponent(
  entity: EntityId,
  component: ComponentRef,
  world: World,
): EntityId | undefined {
  let current = world.getParent(entity);
  while (current !== undefined) {
    if (world.has(current, component)) {
      return current;
    }
    current = world.getParent(current);
  }
  return undefined;
}
