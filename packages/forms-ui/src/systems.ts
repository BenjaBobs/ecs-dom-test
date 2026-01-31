/**
 * Form UI systems for ECS.
 */

import {
  type World,
  type EntityId,
  type ComponentRef,
  defineReactiveSystem,
  added,
  addedOrReplaced,
} from "@ecs-test/ecs";
import { DOMElement, TextContent, getDOMElement } from "@ecs-test/dom";
import type { FormInstance as FormInstanceType, UnboundFieldAccessor } from "@ecs-test/forms";
import {
  FormData,
  FormBinding,
  FormDisplay,
  FieldError,
  TextInput,
  NumberInput,
  FormInstance,
} from "./components.ts";

/**
 * Creates form instance when FormData is added.
 */
export const FormDataInitSystem = defineReactiveSystem({
  triggers: [added(FormData)],
  execute(entities, world) {
    for (const entity of entities) {
      const formData = world.get(entity, FormData);
      if (!formData) continue;

      const instance = formData.factory.create();
      world.add(entity, FormInstance({ instance }));
    }
  },
});

/**
 * Sets up text input binding when FormBinding is added to a TextInput.
 */
export const TextInputBindingSystem = defineReactiveSystem({
  triggers: [added(FormBinding)],
  filter: [TextInput, DOMElement],
  execute(entities, world) {
    for (const entity of entities) {
      const binding = world.get(entity, FormBinding);
      if (!binding) continue;

      const formDataEntity = findAncestorWith(entity, FormData, world);
      if (!formDataEntity) {
        console.warn("FormBinding without FormData ancestor");
        continue;
      }

      const formInstance = world.get(formDataEntity, FormInstance);
      if (!formInstance) continue;

      const el = getDOMElement(world, entity);
      if (!el || !(el instanceof HTMLInputElement)) continue;

      // Get bound accessor
      const boundAccessor = resolveBoundAccessor(formInstance.instance, binding.field);

      // Set initial value
      el.value = String(boundAccessor.get() ?? "");

      // Listen for input changes
      el.addEventListener("input", () => {
        boundAccessor.set(el.value);
        boundAccessor.touch();
      });

      el.addEventListener("blur", () => {
        boundAccessor.touch();
      });

      // Subscribe to form changes to update input
      formInstance.instance.subscribe(() => {
        // Entity may have been removed during re-render
        if (!world.exists(entity)) return;

        const newValue = String(boundAccessor.get() ?? "");
        if (el.value !== newValue) {
          el.value = newValue;
        }
      });
    }
  },
});

/**
 * Sets up number input binding when FormBinding is added to a NumberInput.
 */
export const NumberInputBindingSystem = defineReactiveSystem({
  triggers: [added(FormBinding)],
  filter: [NumberInput, DOMElement],
  execute(entities, world) {
    for (const entity of entities) {
      const binding = world.get(entity, FormBinding);
      if (!binding) continue;

      const formDataEntity = findAncestorWith(entity, FormData, world);
      if (!formDataEntity) {
        console.warn("FormBinding without FormData ancestor");
        continue;
      }

      const formInstance = world.get(formDataEntity, FormInstance);
      if (!formInstance) continue;

      const el = getDOMElement(world, entity);
      if (!el || !(el instanceof HTMLInputElement)) continue;

      el.type = "number";

      // Get bound accessor
      const boundAccessor = resolveBoundAccessor(formInstance.instance, binding.field);

      // Set initial value
      el.value = String(boundAccessor.get() ?? 0);

      // Listen for input changes
      el.addEventListener("input", () => {
        const num = parseFloat(el.value);
        boundAccessor.set(isNaN(num) ? 0 : num);
        boundAccessor.touch();
      });

      el.addEventListener("blur", () => {
        boundAccessor.touch();
      });

      // Subscribe to form changes to update input
      formInstance.instance.subscribe(() => {
        // Entity may have been removed during re-render
        if (!world.exists(entity)) return;

        const newValue = String(boundAccessor.get() ?? 0);
        if (el.value !== newValue) {
          el.value = newValue;
        }
      });
    }
  },
});

/**
 * Sets up read-only display when FormDisplay is added.
 */
export const FormDisplaySystem = defineReactiveSystem({
  triggers: [added(FormDisplay)],
  filter: [DOMElement],
  execute(entities, world) {
    for (const entity of entities) {
      const display = world.get(entity, FormDisplay);
      if (!display) continue;

      const formDataEntity = findAncestorWith(entity, FormData, world);
      if (!formDataEntity) continue;

      const formInstance = world.get(formDataEntity, FormInstance);
      if (!formInstance) continue;

      const boundAccessor = resolveBoundAccessor(formInstance.instance, display.field);

      // Set initial value
      world.set(entity, TextContent({ value: String(boundAccessor.get() ?? "") }));

      // Subscribe to form changes
      formInstance.instance.subscribe(() => {
        // Entity may have been removed during re-render
        if (!world.exists(entity)) return;

        world.set(entity, TextContent({ value: String(boundAccessor.get() ?? "") }));
        world.flush();
      });
    }
  },
});

/**
 * Sets up error display when FieldError is added.
 */
export const FieldErrorSystem = defineReactiveSystem({
  triggers: [added(FieldError)],
  filter: [DOMElement],
  execute(entities, world) {
    for (const entity of entities) {
      const fieldError = world.get(entity, FieldError);
      if (!fieldError) continue;

      const formDataEntity = findAncestorWith(entity, FormData, world);
      if (!formDataEntity) continue;

      const formInstance = world.get(formDataEntity, FormInstance);
      if (!formInstance) continue;

      const boundAccessor = resolveBoundAccessor(formInstance.instance, fieldError.field);

      // Update error display
      const updateError = () => {
        const error = boundAccessor.error;
        const touched = boundAccessor.touched;
        const showError = touched && error;

        world.set(entity, TextContent({ value: showError ? error : "" }));

        const el = getDOMElement(world, entity);
        if (el) {
          (el as HTMLElement).style.display = showError ? "" : "none";
        }
      };

      updateError();

      // Subscribe to form changes
      formInstance.instance.subscribe(() => {
        // Entity may have been removed during re-render
        if (!world.exists(entity)) return;

        updateError();
        world.flush();
      });
    }
  },
});

/**
 * Register all form UI systems.
 */
export function registerFormSystems(world: World): void {
  world.registerSystem(FormDataInitSystem);
  world.registerSystem(TextInputBindingSystem);
  world.registerSystem(NumberInputBindingSystem);
  world.registerSystem(FormDisplaySystem);
  world.registerSystem(FieldErrorSystem);
}

// =============================================================================
// Helpers
// =============================================================================

function findAncestorWith(
  entity: EntityId,
  component: ComponentRef,
  world: World
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveBoundAccessor(instance: FormInstanceType<any>, unbound: UnboundFieldAccessor<any, any>): any {
  // Navigate the path to get the bound accessor
  let accessor: unknown = instance.fields;
  for (const segment of unbound.path) {
    if (typeof segment === "number") {
      accessor = (accessor as { at: (i: number) => unknown }).at(segment);
    } else {
      accessor = (accessor as Record<string, unknown>)[segment];
    }
  }
  return accessor;
}
