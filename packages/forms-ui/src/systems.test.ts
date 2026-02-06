/**
 * Tests for @ecs-test/forms-ui systems.
 */

import { describe, expect, it } from 'bun:test';
import { DOMElement } from '@ecs-test/dom';
import { type TestWorldContext, withTestWorld } from '@ecs-test/dom/testing';
import type { EntityId, World } from '@ecs-test/ecs';
import { createFormFactory, type FormInstance as FormInstanceType } from '@ecs-test/forms';
import { Window } from 'happy-dom';
import {
  FieldError,
  FormBinding,
  FormData,
  FormDisplay,
  FormInstance,
  NumberInput,
  TextInput,
} from './components.ts';
import { registerFormSystems } from './systems.ts';

// =============================================================================
// Test Form Setup
// =============================================================================

type TestAuthor = {
  name: string;
  age: number;
  books: { title: string; score: number }[];
};

const TestAuthorForm = createFormFactory<TestAuthor>({
  initialValues: { name: '', age: 0, books: [] },
  validate: {
    name: v => (!v ? 'Name is required' : undefined),
    age: v => (v < 0 ? 'Age must be positive' : undefined),
  },
});

/**
 * Helper to get a typed form instance from an entity.
 */
function getFormInstance(world: World, entity: EntityId): FormInstanceType<TestAuthor> | undefined {
  const component = world.get(entity, FormInstance);
  return component?.instance as FormInstanceType<TestAuthor> | undefined;
}

// =============================================================================
// Helper: withFormTestWorld
// =============================================================================

function withFormTestWorld<T>(fn: (ctx: TestWorldContext) => T): T {
  return withTestWorld(new Window(), ctx => {
    registerFormSystems(ctx.world);
    return fn(ctx);
  });
}

// =============================================================================
// FormDataInitSystem Tests
// =============================================================================

describe('FormDataInitSystem', () => {
  it('creates FormInstance when FormData is added', () => {
    withFormTestWorld(({ world }) => {
      const entity = world.createEntity(null, [FormData({ factory: TestAuthorForm })]);

      expect(world.has(entity, FormInstance)).toBe(true);

      const formInstance = getFormInstance(world, entity);
      expect(formInstance).toBeDefined();
      expect(formInstance?.getData()).toEqual({ name: '', age: 0, books: [] });
    });
  });

  it('creates isolated form instances for each FormData entity', () => {
    withFormTestWorld(({ world }) => {
      const entity1 = world.createEntity(null, [FormData({ factory: TestAuthorForm })]);
      const entity2 = world.createEntity(null, [FormData({ factory: TestAuthorForm })]);

      const instance1 = getFormInstance(world, entity1);
      const instance2 = getFormInstance(world, entity2);

      // Modify one instance
      instance1?.fields.name.set('Alice');

      // Other instance should be unaffected
      expect(instance1?.getData().name).toBe('Alice');
      expect(instance2?.getData().name).toBe('');
    });
  });
});

// =============================================================================
// TextInputBindingSystem Tests
// =============================================================================

describe('TextInputBindingSystem', () => {
  it('binds text input to form field', () => {
    withFormTestWorld(({ world, container }) => {
      const formEntity = world.createEntity(null, [
        DOMElement({ tag: 'form' }),
        FormData({ factory: TestAuthorForm }),
      ]);

      world.createEntity(formEntity, [
        DOMElement({ tag: 'input' }),
        TextInput(),
        FormBinding({ field: TestAuthorForm.fields.name }),
      ]);

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.value).toBe('');
    });
  });

  it('updates input value when form field changes', () => {
    withFormTestWorld(({ world, container }) => {
      const formEntity = world.createEntity(null, [
        DOMElement({ tag: 'form' }),
        FormData({ factory: TestAuthorForm }),
      ]);

      world.createEntity(formEntity, [
        DOMElement({ tag: 'input' }),
        TextInput(),
        FormBinding({ field: TestAuthorForm.fields.name }),
      ]);

      const formInstance = getFormInstance(world, formEntity);
      formInstance?.fields.name.set('Bob');

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.value).toBe('Bob');
    });
  });

  it('updates form field when input value changes', () => {
    withFormTestWorld(({ world, container }) => {
      const formEntity = world.createEntity(null, [
        DOMElement({ tag: 'form' }),
        FormData({ factory: TestAuthorForm }),
      ]);

      world.createEntity(formEntity, [
        DOMElement({ tag: 'input' }),
        TextInput(),
        FormBinding({ field: TestAuthorForm.fields.name }),
      ]);

      const input = container.querySelector('input') as HTMLInputElement;
      input.value = 'Charlie';
      input.dispatchEvent(new Event('input'));

      const formInstance = getFormInstance(world, formEntity);
      expect(formInstance?.getData().name).toBe('Charlie');
    });
  });

  it('marks field as touched on blur', () => {
    withFormTestWorld(({ world, container }) => {
      const formEntity = world.createEntity(null, [
        DOMElement({ tag: 'form' }),
        FormData({ factory: TestAuthorForm }),
      ]);

      world.createEntity(formEntity, [
        DOMElement({ tag: 'input' }),
        TextInput(),
        FormBinding({ field: TestAuthorForm.fields.name }),
      ]);

      const formInstance = getFormInstance(world, formEntity);
      expect(formInstance?.fields.name.touched).toBe(false);

      const input = container.querySelector('input') as HTMLInputElement;
      input.dispatchEvent(new Event('blur'));

      expect(formInstance?.fields.name.touched).toBe(true);
    });
  });

  it('throws when FormBinding has no FormData ancestor', () => {
    expect(() => {
      withFormTestWorld(({ world }) => {
        // No FormData parent - should throw
        world.createEntity(null, [
          DOMElement({ tag: 'input' }),
          TextInput(),
          FormBinding({ field: TestAuthorForm.fields.name }),
        ]);
      });
    }).toThrow(/FormBinding requires a FormData ancestor/);
  });
});

// =============================================================================
// NumberInputBindingSystem Tests
// =============================================================================

describe('NumberInputBindingSystem', () => {
  it('binds number input to form field', () => {
    withFormTestWorld(({ world, container }) => {
      const formEntity = world.createEntity(null, [
        DOMElement({ tag: 'form' }),
        FormData({ factory: TestAuthorForm }),
      ]);

      world.createEntity(formEntity, [
        DOMElement({ tag: 'input' }),
        NumberInput(),
        FormBinding({ field: TestAuthorForm.fields.age }),
      ]);

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.type).toBe('number');
      expect(input.value).toBe('0');
    });
  });

  it('parses number input correctly', () => {
    withFormTestWorld(({ world, container }) => {
      const formEntity = world.createEntity(null, [
        DOMElement({ tag: 'form' }),
        FormData({ factory: TestAuthorForm }),
      ]);

      world.createEntity(formEntity, [
        DOMElement({ tag: 'input' }),
        NumberInput(),
        FormBinding({ field: TestAuthorForm.fields.age }),
      ]);

      const input = container.querySelector('input') as HTMLInputElement;
      input.value = '42';
      input.dispatchEvent(new Event('input'));

      const formInstance = getFormInstance(world, formEntity);
      expect(formInstance?.getData().age).toBe(42);
    });
  });

  it('handles NaN input by setting to 0', () => {
    withFormTestWorld(({ world, container }) => {
      const formEntity = world.createEntity(null, [
        DOMElement({ tag: 'form' }),
        FormData({ factory: TestAuthorForm }),
      ]);

      world.createEntity(formEntity, [
        DOMElement({ tag: 'input' }),
        NumberInput(),
        FormBinding({ field: TestAuthorForm.fields.age }),
      ]);

      const input = container.querySelector('input') as HTMLInputElement;
      input.value = 'not-a-number';
      input.dispatchEvent(new Event('input'));

      const formInstance = getFormInstance(world, formEntity);
      expect(formInstance?.getData().age).toBe(0);
    });
  });

  it('throws when FormBinding has no FormData ancestor', () => {
    expect(() => {
      withFormTestWorld(({ world }) => {
        world.createEntity(null, [
          DOMElement({ tag: 'input' }),
          NumberInput(),
          FormBinding({ field: TestAuthorForm.fields.age }),
        ]);
      });
    }).toThrow(/FormBinding requires a FormData ancestor/);
  });
});

// =============================================================================
// FormDisplaySystem Tests
// =============================================================================

describe('FormDisplaySystem', () => {
  it('displays form field value', () => {
    withFormTestWorld(({ world, container }) => {
      const formEntity = world.createEntity(null, [
        DOMElement({ tag: 'div' }),
        FormData({ factory: TestAuthorForm }),
      ]);

      // Set initial value before creating display element
      const formInstance = getFormInstance(world, formEntity);
      formInstance?.fields.name.set('Display Test');

      world.createEntity(formEntity, [
        DOMElement({ tag: 'span' }),
        FormDisplay({ field: TestAuthorForm.fields.name }),
      ]);

      const span = container.querySelector('span');
      expect(span).not.toBeNull();
      expect(span?.textContent).toBe('Display Test');
    });
  });

  it('updates display when form field changes', () => {
    withFormTestWorld(({ world, container }) => {
      const formEntity = world.createEntity(null, [
        DOMElement({ tag: 'div' }),
        FormData({ factory: TestAuthorForm }),
      ]);

      world.createEntity(formEntity, [
        DOMElement({ tag: 'span' }),
        FormDisplay({ field: TestAuthorForm.fields.name }),
      ]);

      const formInstance = getFormInstance(world, formEntity);
      formInstance?.fields.name.set('Updated Value');

      const span = container.querySelector('span');
      expect(span?.textContent).toBe('Updated Value');
    });
  });
});

// =============================================================================
// FieldErrorSystem Tests
// =============================================================================

describe('FieldErrorSystem', () => {
  it('hides error when field is not touched', () => {
    withFormTestWorld(({ world, container }) => {
      const formEntity = world.createEntity(null, [
        DOMElement({ tag: 'div' }),
        FormData({ factory: TestAuthorForm }),
      ]);

      world.createEntity(formEntity, [
        DOMElement({ tag: 'span' }),
        FieldError({ field: TestAuthorForm.fields.name }),
      ]);

      const span = container.querySelector('span') as HTMLElement;
      expect(span).not.toBeNull();
      // Field has error (name is empty) but is not touched
      expect(span.style.display).toBe('none');
      expect(span.textContent).toBe('');
    });
  });

  it('shows error when field is touched and invalid', () => {
    withFormTestWorld(({ world, container }) => {
      const formEntity = world.createEntity(null, [
        DOMElement({ tag: 'div' }),
        FormData({ factory: TestAuthorForm }),
      ]);

      world.createEntity(formEntity, [
        DOMElement({ tag: 'span' }),
        FieldError({ field: TestAuthorForm.fields.name }),
      ]);

      const formInstance = getFormInstance(world, formEntity);
      formInstance?.fields.name.touch();

      const span = container.querySelector('span') as HTMLElement;
      expect(span.style.display).toBe('');
      expect(span.textContent).toBe('Name is required');
    });
  });

  it('hides error when field becomes valid', () => {
    withFormTestWorld(({ world, container }) => {
      const formEntity = world.createEntity(null, [
        DOMElement({ tag: 'div' }),
        FormData({ factory: TestAuthorForm }),
      ]);

      world.createEntity(formEntity, [
        DOMElement({ tag: 'span' }),
        FieldError({ field: TestAuthorForm.fields.name }),
      ]);

      const formInstance = getFormInstance(world, formEntity);
      formInstance?.fields.name.touch();
      formInstance?.fields.name.set('Valid Name');

      const span = container.querySelector('span') as HTMLElement;
      expect(span.style.display).toBe('none');
      expect(span.textContent).toBe('');
    });
  });
});

// =============================================================================
// Nested Field Binding Tests
// =============================================================================

describe('Nested field binding', () => {
  it('binds to nested array item fields', () => {
    withFormTestWorld(({ world, container }) => {
      const formEntity = world.createEntity(null, [
        DOMElement({ tag: 'form' }),
        FormData({ factory: TestAuthorForm }),
      ]);

      const formInstance = getFormInstance(world, formEntity);
      formInstance?.fields.books.append({ title: '', score: 0 });

      world.createEntity(formEntity, [
        DOMElement({ tag: 'input' }),
        TextInput(),
        FormBinding({ field: TestAuthorForm.fields.books.at(0).title }),
      ]);

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input).not.toBeNull();
      input.value = 'My Book';
      input.dispatchEvent(new Event('input'));

      expect(formInstance?.getData().books[0]?.title).toBe('My Book');
    });
  });
});

// =============================================================================
// resolveBoundAccessor Error Handling Tests
// =============================================================================

describe('resolveBoundAccessor validation', () => {
  it('throws when path segment is invalid', () => {
    expect(() => {
      withFormTestWorld(({ world }) => {
        const formEntity = world.createEntity(null, [
          DOMElement({ tag: 'form' }),
          FormData({ factory: TestAuthorForm }),
        ]);

        // Create a binding with a field that doesn't exist in the form structure
        // This should throw during resolution
        const invalidField = { path: ['nonexistent', 'deeply', 'nested'] } as unknown;
        world.createEntity(formEntity, [
          DOMElement({ tag: 'input' }),
          TextInput(),
          FormBinding({ field: invalidField as typeof TestAuthorForm.fields.name }),
        ]);
      });
    }).toThrow(/Invalid form field path/);
  });
});
