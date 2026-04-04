// @minimap summary: Defines the binding-target descriptor builder API and the DOMBinding component used to connect DOM elements to value-rooted ECS state.
// @minimap tags: dom binding targets descriptor builder value component dombinding ecs
/**
 * Binding target descriptors and DOM binding component.
 */

import type { ComponentType } from '@ecs-test/ecs';
import { defineComponent } from '@ecs-test/ecs';

type FieldKey<T> = Extract<keyof NonNullable<T>, string>;
type FieldValue<T, K extends FieldKey<T>> = NonNullable<T>[K];
type ArrayItem<T> = NonNullable<T> extends readonly (infer U)[] ? U : never;
type ArrayItemRecord<T> =
  NonNullable<ArrayItem<T>> extends Record<string, unknown> ? NonNullable<ArrayItem<T>> : never;
type ArrayItemKey<T> = Extract<keyof ArrayItemRecord<T>, string>;

export type ValueComponent<T> = ComponentType<{ value: T }>;

export type BindingFieldStep = {
  kind: 'field';
  key: string;
  optional: boolean;
};

export type BindingIndexStep = {
  kind: 'index';
  index: number;
};

export type BindingKeyedStep = {
  kind: 'by';
  key: string;
  value: unknown;
};

export type BindingStep = BindingFieldStep | BindingIndexStep | BindingKeyedStep;

export type BindingDescriptor = {
  component: ValueComponent<unknown>;
  steps: readonly BindingStep[];
};

/**
 * Pure binding descriptor builder.
 * Runtime systems resolve instances of this descriptor for a concrete world/entity.
 */
export class BindingTarget<T = unknown> {
  constructor(private readonly descriptor: BindingDescriptor) {}

  describe(): BindingDescriptor {
    return this.descriptor;
  }

  field<K extends FieldKey<T>>(key: K): BindingTarget<FieldValue<T, K>> {
    return this.append<FieldValue<T, K>>({
      kind: 'field',
      key,
      optional: false,
    });
  }

  fieldMaybe<K extends FieldKey<T>>(key: K): BindingTarget<FieldValue<T, K> | undefined> {
    return this.append<FieldValue<T, K> | undefined>({
      kind: 'field',
      key,
      optional: true,
    });
  }

  at(index: number): BindingTarget<ArrayItem<T>> {
    return this.append<ArrayItem<T>>({
      kind: 'index',
      index,
    });
  }

  by<K extends ArrayItemKey<T>>(key: K, value: ArrayItemRecord<T>[K]): BindingTarget<ArrayItem<T>> {
    return this.append<ArrayItem<T>>({
      kind: 'by',
      key,
      value: value as unknown,
    });
  }

  private append<TNext>(step: BindingStep): BindingTarget<TNext> {
    return new BindingTarget<TNext>({
      component: this.descriptor.component as ValueComponent<unknown>,
      steps: [...this.descriptor.steps, step],
    });
  }
}

export function binding<T>(component: ValueComponent<T>): BindingTarget<T> {
  return new BindingTarget<T>({
    component: component as ValueComponent<unknown>,
    steps: [],
  });
}

export type DOMBindingConfig<T = unknown> = {
  bind: BindingTarget<T> | BindingTarget<unknown>;
  read?: (el: Element) => T;
  write?: (el: Element, value: T) => void;
  readEvent?: string;
  readOnBind?: boolean;
  writeOnBind?: boolean;
  debounceMs?: number;
};

export const DOMBinding = defineComponent<DOMBindingConfig<unknown>>('DOMBinding');
