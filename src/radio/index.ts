/**
 * Radio Group feature - selection components, systems, and bundles.
 */

import {
  type World,
  type EntityId,
  defineComponent,
  defineMarker,
  defineBundle,
  defineReactiveSystem,
  added,
  addedOrReplaced,
  removed,
  DOMElement,
  Clickable,
  TextContent,
  Clicked,
  Classes,
  Disabled,
  type ComponentRef,
} from "../../framework/index.ts";

// =============================================================================
// Components
// =============================================================================

/** Marks an entity as managing selection among its children */
export const Selection = defineMarker("Selection");

/** The currently selected value */
export const SelectedValue = defineComponent<{ value: string }>(
  "SelectedValue"
);

/** A selectable value on a child entity */
export const Value = defineComponent<{ of: string }>("Value");

/** Marks a child as currently selected */
export const Selected = defineMarker("Selected");

/** Radio indicator component (for styling) */
export const Radio = defineMarker("Radio");

/** Named label (e.g., for fieldset legend) */
export const Name = defineComponent<{ value: string }>("Name");

// =============================================================================
// Bundles
// =============================================================================

/**
 * RadioGroup bundle - creates a selection container.
 */
export const RadioGroup = defineBundle(({ name }: { name: string }) => [
  DOMElement({ tag: "fieldset" }),
  Selection(),
  Name({ value: name }),
]);

/**
 * RadioOption bundle - creates a selectable option.
 */
export const RadioOption = defineBundle(({ value }: { value: string }) => [
  DOMElement({ tag: "label" }),
  Clickable(),
  Value({ of: value }),
]);

/**
 * RadioIndicator bundle - the visual radio circle.
 */
export const RadioIndicator = defineBundle(() => [
  DOMElement({ tag: "span", class: "radio" }),
  Radio(),
]);

/**
 * TextSpan bundle - a span element containing text.
 */
export const TextSpan = defineBundle(({ content }: { content: string }) => [
  DOMElement({ tag: "span" }),
  TextContent({ value: content }),
]);

// =============================================================================
// Systems
// =============================================================================

/**
 * When a child with Value is clicked, update the parent's SelectedValue.
 */
const SelectionClickSystem = defineReactiveSystem({
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
  triggers: [added(Selected)],
  filter: [Radio],
  execute(entities, world) {
    for (const entity of entities) {
      world.set(entity, Classes({ list: ["radio", "selected"] }));
    }
  },
});

/**
 * Initialize radio visual when Radio component is added.
 */
const RadioInitSystem = defineReactiveSystem({
  triggers: [added(Radio)],
  execute(entities, world) {
    for (const entity of entities) {
      if (!world.has(entity, Selected)) {
        world.set(entity, Classes({ list: ["radio"] }));
      }
    }
  },
});

/**
 * Update radio visual when Selected is removed.
 */
const RadioDeselectSystem = defineReactiveSystem({
  triggers: [removed(Selected)],
  filter: [Radio],
  execute(entities, world) {
    for (const entity of entities) {
      world.set(entity, Classes({ list: ["radio"] }));
    }
  },
});

/**
 * When an entity has Name, create a legend child element.
 */
const NameLegendSystem = defineReactiveSystem({
  triggers: [added(Name)],
  execute(entities, world) {
    for (const entity of entities) {
      const name = world.get(entity, Name);
      if (!name) continue;

      const legendEntity = world.createEntity(entity);
      world.add(legendEntity, { _tag: "DOMElement", data: { tag: "legend" } });
      world.add(legendEntity, {
        _tag: "TextContent",
        data: { value: name.value },
      });
    }
  },
});

/**
 * Register all radio systems.
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
  world: World
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
