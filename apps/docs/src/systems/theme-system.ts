/**
 * ThemeSystem — toggles data-theme on <html>, persists to localStorage.
 */

import { Clicked, getDOMElement } from '@ecs-test/dom';
import { defineReactiveSystem, Entities, type World } from '@ecs-test/ecs';
import { ThemeState, ThemeToggle } from '../components.ts';

function getWindow(world: World): Window | undefined {
  return world.getExternals().window;
}

function applyTheme(world: World, mode: 'light' | 'dark') {
  const win = getWindow(world);
  if (!win) return;

  win.document.documentElement.dataset.theme = mode;

  const toggleEntities = world.query(ThemeToggle);
  for (const toggleEntity of toggleEntities) {
    const toggle = getDOMElement(world, toggleEntity);
    if (toggle) {
      toggle.textContent = mode === 'dark' ? 'Light Mode' : 'Dark Mode';
      toggle.setAttribute('type', 'button');
      toggle.setAttribute('aria-label', 'Toggle color theme');
    }
  }
}

function persistTheme(world: World, mode: 'light' | 'dark') {
  const win = getWindow(world);
  if (!win) return;

  try {
    win.localStorage.setItem('docs-theme', mode);
  } catch {
    // localStorage may be unavailable.
  }
}

export const ThemeApplySystem = defineReactiveSystem({
  name: 'ThemeApplySystem',
  query: Entities.with([ThemeState]),
  onEnter(world, entities) {
    for (const entity of entities) {
      const state = world.get(entity, ThemeState);
      if (!state) continue;

      applyTheme(world, state.mode);
      persistTheme(world, state.mode);
    }
  },
  onUpdate(world, entities) {
    for (const entity of entities) {
      const state = world.get(entity, ThemeState);
      if (!state) continue;

      applyTheme(world, state.mode);
      persistTheme(world, state.mode);
    }
  },
});

export const ThemeToggleClickSystem = defineReactiveSystem({
  name: 'ThemeToggleClickSystem',
  query: Entities.with([ThemeToggle, Clicked]),
  onEnter(world, entities) {
    const themeEntities = world.query(ThemeState);
    if (themeEntities.length === 0) return;

    const themeEntity = themeEntities[0];
    if (!themeEntity) return;

    for (const entity of entities) {
      world.remove(entity, Clicked);

      const current = world.get(themeEntity, ThemeState);
      if (!current) continue;

      const next = current.mode === 'light' ? 'dark' : 'light';
      world.set(themeEntity, ThemeState({ mode: next }));
    }
  },
});
