/**
 * Form UI systems for ECS.
 */

import { DOMElement, getDOMElement, TextContent } from '@ecs-test/dom';
import {
  assert,
  type ComponentRef,
  defineReactiveSystem,
  Entities,
  type EntityId,
  type World,
} from '@ecs-test/ecs';
import type { FormInstance as FormInstanceType, UnboundFieldAccessor } from '@ecs-test/forms';
import {
  FieldError,
  FormBinding,
  FormData,
  FormDisplay,
  FormInstance,
  NumberInput,
  TextInput,
} from './components.ts';

/**
 * Creates form instance when FormData is added.
 */
export const FormDataInitSystem = defineReactiveSystem({
  name: 'FormDataInitSystem',
  query: Entities.with([FormData]),
  onEnter(world, entities) {
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
  name: 'TextInputBindingSystem',
  query: Entities.with([FormBinding, TextInput, DOMElement]),
  onEnter(world, entities) {
    for (const entity of entities) {
      const binding = world.get(entity, FormBinding);
      if (!binding) continue;

      const formDataEntity = findAncestorWith(entity, FormData, world);
      assert(
        formDataEntity !== undefined,
        `FormBinding requires a FormData ancestor. Entity ${entity} has TextInput + FormBinding but no FormData in its parent chain.`,
      );

      const formInstance = world.get(formDataEntity, FormInstance);
      if (!formInstance) continue;

      const el = getDOMElement(world, entity);
      if (!el || !isInputElement(el)) continue;

      // Get bound accessor
      const boundAccessor = resolveBoundAccessor(formInstance.instance, binding.field);

      // Set initial value
      el.value = String(boundAccessor.get() ?? '');

      // Listen for input changes
      el.addEventListener('input', () => {
        boundAccessor.set(el.value);
        boundAccessor.touch();
      });

      el.addEventListener('blur', () => {
        boundAccessor.touch();
      });

      // Subscribe to form changes to update input
      formInstance.instance.subscribe(() => {
        // Entity may have been removed during re-render
        if (!world.exists(entity)) return;

        const newValue = String(boundAccessor.get() ?? '');
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
  name: 'NumberInputBindingSystem',
  query: Entities.with([FormBinding, NumberInput, DOMElement]),
  onEnter(world, entities) {
    for (const entity of entities) {
      const binding = world.get(entity, FormBinding);
      if (!binding) continue;

      const formDataEntity = findAncestorWith(entity, FormData, world);
      assert(
        formDataEntity !== undefined,
        `FormBinding requires a FormData ancestor. Entity ${entity} has NumberInput + FormBinding but no FormData in its parent chain.`,
      );

      const formInstance = world.get(formDataEntity, FormInstance);
      if (!formInstance) continue;

      const el = getDOMElement(world, entity);
      if (!el || !isInputElement(el)) continue;

      el.type = 'number';

      // Get bound accessor
      const boundAccessor = resolveBoundAccessor(formInstance.instance, binding.field);

      // Set initial value
      el.value = String(boundAccessor.get() ?? 0);

      // Listen for input changes
      el.addEventListener('input', () => {
        const num = parseFloat(el.value);
        boundAccessor.set(Number.isNaN(num) ? 0 : num);
        boundAccessor.touch();
      });

      el.addEventListener('blur', () => {
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
  name: 'FormDisplaySystem',
  query: Entities.with([FormDisplay, DOMElement]),
  onEnter(world, entities) {
    for (const entity of entities) {
      const display = world.get(entity, FormDisplay);
      if (!display) continue;

      const formDataEntity = findAncestorWith(entity, FormData, world);
      if (!formDataEntity) continue;

      const formInstance = world.get(formDataEntity, FormInstance);
      if (!formInstance) continue;

      const boundAccessor = resolveBoundAccessor(formInstance.instance, display.field);

      // Set initial value
      world.set(entity, TextContent({ value: String(boundAccessor.get() ?? '') }));

      // Subscribe to form changes
      formInstance.instance.subscribe(() => {
        // Entity may have been removed during re-render
        if (!world.exists(entity)) return;

        world.set(entity, TextContent({ value: String(boundAccessor.get() ?? '') }));
      });
    }
  },
});

/**
 * Sets up error display when FieldError is added.
 */
export const FieldErrorSystem = defineReactiveSystem({
  name: 'FieldErrorSystem',
  query: Entities.with([FieldError, DOMElement]),
  onEnter(world, entities) {
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

        world.set(entity, TextContent({ value: showError ? error : '' }));

        const el = getDOMElement(world, entity);
        if (el) {
          (el as HTMLElement).style.display = showError ? '' : 'none';
        }
      };

      updateError();

      // Subscribe to form changes
      formInstance.instance.subscribe(() => {
        // Entity may have been removed during re-render
        if (!world.exists(entity)) return;

        updateError();
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BoundAccessor = {
  get(): unknown;
  set(value: unknown): void;
  touch(): void;
  readonly error?: string;
  readonly touched?: boolean;
};

function resolveBoundAccessor(
  instance: FormInstanceType<unknown>,
  unbound: UnboundFieldAccessor<unknown, unknown>,
): BoundAccessor {
  // Navigate the path to get the bound accessor
  let accessor: unknown = instance.fields;
  const pathSoFar: (string | number)[] = [];

  for (const segment of unbound.path) {
    assert(
      accessor != null,
      `Invalid form field path: "${unbound.path.join('.')}". Path segment "${pathSoFar.join('.')}" resolved to null/undefined.`,
    );

    if (typeof segment === 'number') {
      const atFn = (accessor as { at?: (i: number) => unknown }).at;
      assert(
        typeof atFn === 'function',
        `Invalid form field path: "${unbound.path.join('.')}". Expected array accessor at "${pathSoFar.join('.')}" but got ${typeof accessor}.`,
      );
      accessor = atFn.call(accessor, segment);
    } else {
      accessor = (accessor as Record<string, unknown>)[segment];
    }
    pathSoFar.push(segment);
  }

  assert(
    accessor != null,
    `Invalid form field path: "${unbound.path.join('.')}". Path resolved to null/undefined.`,
  );

  return accessor as BoundAccessor;
}

/**
 * Type representing an input element with the properties we need.
 * Uses duck-typing to work with any DOM implementation (happy-dom, jsdom, real browser).
 */
type InputElementLike = {
  value: string;
  type: string;
  addEventListener: (event: string, handler: () => void) => void;
};

/**
 * Duck-type check for input elements.
 * Avoids instanceof HTMLInputElement which requires browser globals.
 */
function isInputElement(el: unknown): el is InputElementLike {
  if (el == null || typeof el !== 'object') return false;
  const candidate = el as Record<string, unknown>;
  return (
    'value' in candidate && 'type' in candidate && typeof candidate.addEventListener === 'function'
  );
}
