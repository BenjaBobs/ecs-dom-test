/**
 * Radio group systems.
 */

import { Classes, Clicked, Disabled } from '@ecs-test/dom';
import {
  added,
  addedOrReplaced,
  type ComponentRef,
  defineReactiveSystem,
  type EntityId,
  removed,
  type World,
} from '@ecs-test/ecs';
import { Name, Radio, Selected, SelectedValue, Selection, Value } from './components.ts';

/**
 * When a child with Value is clicked, update the parent's SelectedValue.
 */
const SelectionClickSystem = defineReactiveSystem({
  name: 'SelectionClickSystem',
  triggers: [added(Clicked)],
  filter: [Value],
  execute(entities, world) {
    for (const entity of entities) {
      if (world.has(entity, Disabled)) {
        world.remove(entity, Clicked);
        continue;
      }

      const parent = findAncestorWith(entity, Selection, world);
      if (parent !== undefined) {
        const value = world.get(entity, Value);
        if (value) {
          world.set(parent, SelectedValue({ value: value.of }));
        }
      }

      world.remove(entity, Clicked);
    }
  },
});

/**
 * Sync Selected marker on children when SelectedValue changes.
 */
const SelectionSyncSystem = defineReactiveSystem({
  name: 'SelectionSyncSystem',
  triggers: [addedOrReplaced(SelectedValue)],
  filter: [Selection],
  execute(entities, world) {
    for (const parent of entities) {
      const selectedValue = world.get(parent, SelectedValue);
      if (!selectedValue) continue;

      const descendants = getAllDescendants(parent, world);
      for (const descendant of descendants) {
        const value = world.get(descendant, Value);
        if (value) {
          const isSelected = value.of === selectedValue.value;

          if (isSelected) {
            world.set(descendant, Selected());
          } else {
            world.remove(descendant, Selected);
          }

          for (const child of world.getChildren(descendant)) {
            if (world.has(child, Radio)) {
              if (isSelected) {
                world.set(child, Selected());
              } else {
                world.remove(child, Selected);
              }
            }
          }
        }
      }
    }
  },
});

/**
 * Update radio visual classes based on Selected state.
 */
const RadioRenderSystem = defineReactiveSystem({
  name: 'RadioRenderSystem',
  triggers: [added(Selected)],
  filter: [Radio],
  execute(entities, world) {
    for (const entity of entities) {
      world.set(entity, Classes({ list: ['radio', 'selected'] }));
    }
  },
});

/**
 * Initialize radio visual when Radio component is added.
 */
const RadioInitSystem = defineReactiveSystem({
  name: 'RadioInitSystem',
  triggers: [added(Radio)],
  execute(entities, world) {
    for (const entity of entities) {
      if (!world.has(entity, Selected)) {
        world.set(entity, Classes({ list: ['radio'] }));
      }
    }
  },
});

/**
 * Update radio visual when Selected is removed.
 */
const RadioDeselectSystem = defineReactiveSystem({
  name: 'RadioDeselectSystem',
  triggers: [removed(Selected)],
  filter: [Radio],
  execute(entities, world) {
    for (const entity of entities) {
      world.set(entity, Classes({ list: ['radio'] }));
    }
  },
});

/**
 * When an entity has Name, create a legend child element.
 */
const NameLegendSystem = defineReactiveSystem({
  name: 'NameLegendSystem',
  triggers: [added(Name)],
  execute(entities, world) {
    for (const entity of entities) {
      const name = world.get(entity, Name);
      if (!name) continue;

      const legendEntity = world.createEntity(entity);
      world.add(legendEntity, { _tag: 'DOMElement', data: { tag: 'legend' } });
      world.add(legendEntity, {
        _tag: 'TextContent',
        data: { value: name.value },
      });
    }
  },
});

/**
 * Register all radio systems with the world.
 */
export function registerRadioSystems(world: World): void {
  world.registerSystem(SelectionClickSystem);
  world.registerSystem(SelectionSyncSystem);
  world.registerSystem(RadioRenderSystem);
  world.registerSystem(RadioInitSystem);
  world.registerSystem(RadioDeselectSystem);
  world.registerSystem(NameLegendSystem);
}

// =============================================================================
// Helpers
// =============================================================================

function findAncestorWith(
  entity: EntityId,
  componentTag: ComponentRef,
  world: World,
): EntityId | undefined {
  let current = world.getParent(entity);
  while (current !== undefined) {
    if (world.has(current, componentTag)) {
      return current;
    }
    current = world.getParent(current);
  }
  return undefined;
}

function getAllDescendants(entity: EntityId, world: World): EntityId[] {
  const result: EntityId[] = [];
  const stack = [...world.getChildren(entity)];

  while (stack.length > 0) {
    const current = stack.pop()!;
    result.push(current);
    stack.push(...world.getChildren(current));
  }

  return result;
}
