/**
 * Core types for the forms package.
 */

/** Validation function - returns error message or undefined if valid */
export type ValidateFn<T> = (value: T) => string | undefined;

/** Computed field derivation function */
export type ComputeFn<TForm, TValue> = (data: TForm) => TValue;

/**
 * Validation schema for a form.
 * Each field can have a validator, objects have nested validators,
 * arrays use _self for array-level and nested for item-level.
 */
export type ValidationSchema<T> = {
  [K in keyof T]?: T[K] extends (infer Item)[]
    ? { _self?: ValidateFn<T[K]> } & ValidationSchema<Item>
    : T[K] extends object
      ? ValidationSchema<T[K]>
      : ValidateFn<T[K]>;
};

/** Computed fields schema */
export type ComputedSchema<T> = {
  [K in keyof T]?: ComputeFn<T, T[K]>;
};

/** Form factory configuration */
export type FormFactoryConfig<T> = {
  initialValues: T;
  validate?: ValidationSchema<T>;
  computed?: ComputedSchema<T>;
};

/** Subscription callback for form changes */
export type FormSubscriber<T> = (form: FormInstance<T>) => void;

/** Form instance - created from a factory */
export interface FormInstance<T> {
  /** Get the complete form data */
  getData(): T;

  /** Check if the entire form is valid */
  readonly isValid: boolean;

  /** Check if any field has been modified */
  readonly isDirty: boolean;

  /** Get all current errors as a map of path -> message */
  readonly errors: Map<string, string>;

  /** Get typed field accessors */
  readonly fields: BoundFieldAccessors<T>;

  /** Subscribe to form changes */
  subscribe(callback: FormSubscriber<T>): () => void;

  /** Reset form to initial values */
  reset(): void;

  /** Submit the form - returns data if valid, null if invalid */
  submit(): { ok: true; data: T } | { ok: false; errors: Map<string, string> };
}

/** Form factory - creates instances */
export interface FormFactory<T> {
  /** Create a new form instance */
  create(initialValues?: Partial<T>): FormInstance<T>;

  /** Unbound field accessors for use in UI (resolved via FormData ancestor) */
  readonly fields: UnboundFieldAccessors<T>;
}

// =============================================================================
// Field Accessors
// =============================================================================

/** Base accessor properties shared by bound and unbound */
type BaseAccessor = {
  readonly path: readonly (string | number)[];
};

/** Unbound accessor - knows path/type but not instance (from factory) */
export type UnboundFieldAccessor<TForm, TValue> = BaseAccessor & {
  readonly _phantom?: { form: TForm; value: TValue };
} & (TValue extends (infer Item)[]
    ? UnboundArrayAccessor<TForm, Item>
    : TValue extends object
      ? { readonly [K in keyof TValue]: UnboundFieldAccessor<TForm, TValue[K]> }
      : object);

/** Unbound array accessor */
export type UnboundArrayAccessor<TForm, TItem> = {
  at(index: number): UnboundFieldAccessor<TForm, TItem> & UnboundArrayItemAccessor;
} & { readonly [K in keyof TItem]: UnboundFieldAccessor<TForm, TItem[K]> };

/** Additional properties on array item accessors */
export type UnboundArrayItemAccessor = {
  readonly _isArrayItem: true;
};

/** Generate unbound accessors for a form type */
export type UnboundFieldAccessors<T> = {
  readonly [K in keyof T]: UnboundFieldAccessor<T, T[K]>;
};

/** Bound accessor - attached to a specific form instance */
export type BoundFieldAccessor<TValue> = {
  /** Get current value */
  get(): TValue;
  /** Set value (not available on computed fields) */
  set(value: TValue): void;
  /** Current validation error */
  readonly error: string | undefined;
  /** Has the field been modified? */
  readonly isDirty: boolean;
  /** Has the user interacted with this field? */
  readonly touched: boolean;
  /** Mark as touched */
  touch(): void;
  /** Is this a computed (read-only) field? */
  readonly isComputed: boolean;
} & (TValue extends (infer Item)[]
  ? BoundArrayAccessor<Item>
  : TValue extends object
    ? { readonly [K in keyof TValue]: BoundFieldAccessor<TValue[K]> }
    : object);

/** Bound array accessor */
export type BoundArrayAccessor<TItem> = {
  /** Number of items */
  readonly length: number;
  /** Get accessor for item at index */
  at(index: number): BoundArrayItemAccessor<TItem>;
  /** Iterate over item accessors */
  map<R>(fn: (item: BoundArrayItemAccessor<TItem>, index: number) => R): R[];
  forEach(fn: (item: BoundArrayItemAccessor<TItem>, index: number) => void): void;
  [Symbol.iterator](): Iterator<BoundArrayItemAccessor<TItem>>;
  /** Append item to end */
  append(item: TItem): void;
  /** Prepend item to start */
  prepend(item: TItem): void;
  /** Insert item at index */
  insert(index: number, item: TItem): void;
  /** Remove item at index */
  remove(index: number): void;
  /** Remove items matching predicate */
  removeWhere(predicate: (item: BoundArrayItemAccessor<TItem>) => boolean): void;
  /** Move item from one index to another */
  move(fromIndex: number, toIndex: number): void;
  /** Clear all items */
  clear(): void;
};

/** Bound array item accessor - has additional self-aware methods */
export type BoundArrayItemAccessor<TItem> = BoundFieldAccessor<TItem> & {
  /** Stable key for this item (survives reordering) */
  readonly key: string;
  /** Current index in the array */
  readonly index: number;
  /** Remove this item from the array */
  remove(): void;
  /** Move this item up (swap with previous) */
  moveUp(): void;
  /** Move this item down (swap with next) */
  moveDown(): void;
  /** Is this the first item? */
  readonly isFirst: boolean;
  /** Is this the last item? */
  readonly isLast: boolean;
};

/** Generate bound accessors for a form type */
export type BoundFieldAccessors<T> = {
  readonly [K in keyof T]: BoundFieldAccessor<T[K]>;
};
