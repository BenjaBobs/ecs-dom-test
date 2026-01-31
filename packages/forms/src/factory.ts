/**
 * Form factory implementation.
 */

import type {
  FormFactory,
  FormFactoryConfig,
  FormInstance,
  UnboundFieldAccessors,
  BoundFieldAccessors,
  FormSubscriber,
  ValidateFn,
  ValidationSchema,
  ComputedSchema,
} from './types.ts';
import { assert } from './assert.ts';

/**
 * Create a form factory for a given type.
 *
 * @example
 * const AuthorForm = createFormFactory<Author>({
 *   initialValues: { name: "", age: 0, books: [] },
 *   validate: {
 *     name: (v) => !v ? "Required" : undefined,
 *   },
 *   computed: {
 *     averageScore: (data) => calculateAverage(data.books),
 *   }
 * });
 *
 * // Create instances
 * const form = AuthorForm.create();
 * form.fields.name.set("Alice");
 */
export function createFormFactory<T extends object>(config: FormFactoryConfig<T>): FormFactory<T> {
  assert(!!config, 'Form factory config is required');
  assert(
    config.initialValues !== undefined && config.initialValues !== null,
    'initialValues is required',
  );
  const { initialValues, validate, computed } = config;

  // Create unbound field accessors (for UI binding)
  const unboundFields = createUnboundAccessors<T>(initialValues);

  return {
    create(overrides?: Partial<T>): FormInstance<T> {
      return createFormInstance<T>({ ...initialValues, ...overrides }, validate, computed);
    },
    fields: unboundFields,
  };
}

// =============================================================================
// Form Instance
// =============================================================================

function createFormInstance<T extends object>(
  initialValues: T,
  validateSchema?: ValidationSchema<T>,
  computedSchema?: ComputedSchema<T>,
): FormInstance<T> {
  // Internal state
  let data = structuredClone(initialValues);
  const initialData = structuredClone(initialValues);
  const touched = new Set<string>();
  const subscribers = new Set<FormSubscriber<T>>();
  const itemKeys = new Map<string, Map<number, string>>(); // path -> index -> key
  let nextKeyId = 1;

  // Notify subscribers
  const notify = () => {
    for (const sub of subscribers) {
      sub(instance);
    }
  };

  // Get value at path
  const getAtPath = (path: readonly (string | number)[]): unknown => {
    let current: unknown = data;
    for (const segment of path) {
      if (current == null) return undefined;
      current = (current as Record<string | number, unknown>)[segment];
    }
    return current;
  };

  // Set value at path
  const setAtPath = (path: readonly (string | number)[], value: unknown): void => {
    if (path.length === 0) {
      data = value as T;
      return;
    }

    let current: Record<string | number, unknown> = data as Record<string | number, unknown>;
    for (let i = 0; i < path.length - 1; i++) {
      const segment = path[i]!;
      if (current[segment] == null) {
        current[segment] = typeof path[i + 1] === 'number' ? [] : {};
      }
      current = current[segment] as Record<string | number, unknown>;
    }
    current[path[path.length - 1]!] = value;

    // Recompute computed fields
    recompute();
    notify();
  };

  // Recompute computed fields
  const recompute = (): void => {
    if (!computedSchema) return;
    for (const [key, computeFn] of Object.entries(computedSchema)) {
      if (typeof computeFn === 'function') {
        (data as Record<string, unknown>)[key] = computeFn(data);
      }
    }
  };

  // Validate a field
  const validateField = (path: readonly (string | number)[]): string | undefined => {
    if (!validateSchema) return undefined;

    let schema: unknown = validateSchema;
    for (const segment of path) {
      if (schema == null) return undefined;
      if (typeof segment === 'number') {
        // For array items, schema applies to each item
        continue;
      }
      schema = (schema as Record<string, unknown>)[segment];
    }

    if (typeof schema === 'function') {
      const value = getAtPath(path);
      return (schema as ValidateFn<unknown>)(value);
    }

    return undefined;
  };

  // Get all errors
  const getAllErrors = (): Map<string, string> => {
    const errors = new Map<string, string>();

    const collectErrors = (obj: unknown, path: (string | number)[]): void => {
      if (obj == null) return;

      if (Array.isArray(obj)) {
        // Check array-level validation
        const pathStr = path.join('.');
        const error = validateField(path);
        if (error) errors.set(pathStr, error);

        // Check each item
        obj.forEach((_, index) => {
          collectErrors(obj[index], [...path, index]);
        });
      } else if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
          collectErrors((obj as Record<string, unknown>)[key], [...path, key]);
        }
      } else {
        const pathStr = path.join('.');
        const error = validateField(path);
        if (error) errors.set(pathStr, error);
      }
    };

    collectErrors(data, []);
    return errors;
  };

  // Get or create stable key for array item
  const getItemKey = (arrayPath: string, index: number): string => {
    let pathKeys = itemKeys.get(arrayPath);
    if (!pathKeys) {
      pathKeys = new Map();
      itemKeys.set(arrayPath, pathKeys);
    }
    let key = pathKeys.get(index);
    if (!key) {
      key = `k${nextKeyId++}`;
      pathKeys.set(index, key);
    }
    return key;
  };

  // Shift keys when array is modified
  const shiftKeys = (arrayPath: string, fromIndex: number, delta: number): void => {
    const pathKeys = itemKeys.get(arrayPath);
    if (!pathKeys) return;

    const newKeys = new Map<number, string>();
    for (const [index, key] of pathKeys) {
      if (index < fromIndex) {
        newKeys.set(index, key);
      } else {
        newKeys.set(index + delta, key);
      }
    }
    itemKeys.set(arrayPath, newKeys);
  };

  const swapKeys = (arrayPath: string, indexA: number, indexB: number): void => {
    const pathKeys = itemKeys.get(arrayPath);
    if (!pathKeys) return;
    const keyA = pathKeys.get(indexA);
    const keyB = pathKeys.get(indexB);
    if (keyA !== undefined) {
      pathKeys.set(indexB, keyA);
    } else {
      pathKeys.delete(indexB);
    }
    if (keyB !== undefined) {
      pathKeys.set(indexA, keyB);
    } else {
      pathKeys.delete(indexA);
    }
  };

  const moveKey = (arrayPath: string, fromIndex: number, toIndex: number): void => {
    if (fromIndex === toIndex) return;
    const pathKeys = itemKeys.get(arrayPath);
    if (!pathKeys) return;

    const movingKey = pathKeys.get(fromIndex);
    const newKeys = new Map<number, string>();

    for (const [index, key] of pathKeys) {
      if (index === fromIndex) continue;
      if (fromIndex < toIndex) {
        if (index > fromIndex && index <= toIndex) {
          newKeys.set(index - 1, key);
        } else {
          newKeys.set(index, key);
        }
      } else {
        if (index >= toIndex && index < fromIndex) {
          newKeys.set(index + 1, key);
        } else {
          newKeys.set(index, key);
        }
      }
    }

    if (movingKey !== undefined) {
      newKeys.set(toIndex, movingKey);
    }

    itemKeys.set(arrayPath, newKeys);
  };

  // Create bound field accessor
  const createBoundAccessor = (path: readonly (string | number)[]): unknown => {
    const pathStr = path.join('.');
    const isComputedField =
      computedSchema && path.length === 1 && path[0] !== undefined && path[0] in computedSchema;

    const accessor: Record<string, unknown> = {
      get: () => getAtPath(path),
      set: (value: unknown) => {
        if (isComputedField) {
          throw new Error(`Cannot set computed field: ${pathStr}`);
        }
        setAtPath(path, value);
        touched.add(pathStr);
      },
      get error() {
        return validateField(path);
      },
      get isDirty() {
        const initial = getAtPath.call({ data: initialData }, path);
        const current = getAtPath(path);
        return JSON.stringify(initial) !== JSON.stringify(current);
      },
      get touched() {
        return touched.has(pathStr);
      },
      touch: () => {
        touched.add(pathStr);
        notify();
      },
      isComputed: isComputedField,
    };

    const currentValue = getAtPath(path);

    // Array accessors
    if (Array.isArray(currentValue)) {
      Object.assign(accessor, createArrayAccessor(path, pathStr));
    }
    // Object accessors (but not arrays)
    else if (currentValue != null && typeof currentValue === 'object') {
      for (const key of Object.keys(currentValue)) {
        Object.defineProperty(accessor, key, {
          get: () => createBoundAccessor([...path, key]),
          enumerable: true,
        });
      }
    }

    return accessor;
  };

  // Create array-specific accessor methods
  const createArrayAccessor = (path: readonly (string | number)[], pathStr: string) => {
    const getArray = () => getAtPath(path) as unknown[];

    return {
      get length() {
        return getArray().length;
      },

      at: (index: number) => {
        const itemAccessor = createBoundAccessor([...path, index]) as Record<string, unknown>;
        Object.assign(itemAccessor, {
          key: getItemKey(pathStr, index),
          get index() {
            return index;
          },
          remove: () => {
            const arr = getArray();
            arr.splice(index, 1);
            setAtPath(path, arr);
            shiftKeys(pathStr, index + 1, -1);
          },
          moveUp: () => {
            if (index > 0) {
              const arr = getArray();
              [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
              setAtPath(path, arr);
              swapKeys(pathStr, index - 1, index);
            }
          },
          moveDown: () => {
            const arr = getArray();
            if (index < arr.length - 1) {
              [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
              setAtPath(path, arr);
              swapKeys(pathStr, index, index + 1);
            }
          },
          get isFirst() {
            return index === 0;
          },
          get isLast() {
            return index === getArray().length - 1;
          },
        });
        return itemAccessor;
      },

      map: <R>(fn: (item: unknown, index: number) => R): R[] => {
        const arr = getArray();
        const accessor = createBoundAccessor(path) as { at: (i: number) => unknown };
        return arr.map((_, i) => fn(accessor.at(i), i));
      },

      forEach: (fn: (item: unknown, index: number) => void): void => {
        const arr = getArray();
        const accessor = createBoundAccessor(path) as { at: (i: number) => unknown };
        arr.forEach((_, i) => fn(accessor.at(i), i));
      },

      [Symbol.iterator]: function* () {
        const arr = getArray();
        const accessor = createBoundAccessor(path) as { at: (i: number) => unknown };
        for (let i = 0; i < arr.length; i++) {
          yield accessor.at(i);
        }
      },

      append: (item: unknown): void => {
        const arr = getArray();
        arr.push(item);
        setAtPath(path, arr);
      },

      prepend: (item: unknown): void => {
        const arr = getArray();
        arr.unshift(item);
        setAtPath(path, arr);
        shiftKeys(pathStr, 0, 1);
      },

      insert: (index: number, item: unknown): void => {
        const arr = getArray();
        arr.splice(index, 0, item);
        setAtPath(path, arr);
        shiftKeys(pathStr, index, 1);
      },

      remove: (index: number): void => {
        const arr = getArray();
        arr.splice(index, 1);
        setAtPath(path, arr);
        shiftKeys(pathStr, index + 1, -1);
      },

      removeWhere: (predicate: (item: unknown) => boolean): void => {
        const arr = getArray();
        const accessor = createBoundAccessor(path) as { at: (i: number) => unknown };
        const toRemove: number[] = [];
        arr.forEach((_, i) => {
          if (predicate(accessor.at(i))) {
            toRemove.push(i);
          }
        });
        // Remove in reverse order to preserve indices
        for (let i = toRemove.length - 1; i >= 0; i--) {
          arr.splice(toRemove[i]!, 1);
        }
        setAtPath(path, arr);
      },

      move: (fromIndex: number, toIndex: number): void => {
        const arr = getArray();
        const [item] = arr.splice(fromIndex, 1);
        arr.splice(toIndex, 0, item);
        setAtPath(path, arr);
        moveKey(pathStr, fromIndex, toIndex);
      },

      clear: (): void => {
        setAtPath(path, []);
        itemKeys.delete(pathStr);
      },
    };
  };

  // Create the fields proxy
  const createFieldsProxy = (): BoundFieldAccessors<T> => {
    return new Proxy({} as BoundFieldAccessors<T>, {
      get(_, prop: string) {
        return createBoundAccessor([prop]);
      },
    });
  };

  // Initial computation
  recompute();

  const instance: FormInstance<T> = {
    getData: () => structuredClone(data),

    get isValid() {
      return getAllErrors().size === 0;
    },

    get isDirty() {
      return JSON.stringify(data) !== JSON.stringify(initialData);
    },

    get errors() {
      return getAllErrors();
    },

    get fields() {
      return createFieldsProxy();
    },

    subscribe(callback: FormSubscriber<T>) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },

    reset() {
      data = structuredClone(initialData);
      touched.clear();
      itemKeys.clear();
      recompute();
      notify();
    },

    submit() {
      // Mark all fields as touched
      const markAllTouched = (obj: unknown, path: string[]): void => {
        if (obj == null) return;
        if (Array.isArray(obj)) {
          touched.add(path.join('.'));
          obj.forEach((item, index) => markAllTouched(item, [...path, String(index)]));
        } else if (typeof obj === 'object') {
          for (const key of Object.keys(obj)) {
            markAllTouched((obj as Record<string, unknown>)[key], [...path, key]);
          }
        } else {
          touched.add(path.join('.'));
        }
      };
      markAllTouched(data, []);
      notify();

      const errors = getAllErrors();
      if (errors.size > 0) {
        return { ok: false, errors };
      }
      return { ok: true, data: structuredClone(data) };
    },
  };

  return instance;
}

// =============================================================================
// Unbound Accessors
// =============================================================================

function createUnboundAccessors<T>(template: T): UnboundFieldAccessors<T> {
  const createAccessor = (path: readonly (string | number)[], value: unknown): unknown => {
    const accessor: Record<string, unknown> = {
      path,
    };

    if (Array.isArray(value)) {
      accessor.at = (index: number) => {
        const itemTemplate = value.length > 0 ? value[0] : {};
        // Use a Proxy to handle unknown property access on array items
        // This allows f.books.at(0).title even when books is initially empty
        return new Proxy(createAccessor([...path, index], itemTemplate) as object, {
          get(target, prop: string) {
            if (prop in target) {
              return (target as Record<string, unknown>)[prop];
            }
            // For unknown properties, create a sub-accessor with the extended path
            return createAccessor([...path, index, prop], undefined);
          },
        });
      };
      // Add property accessors for array item fields
      if (value.length > 0 && typeof value[0] === 'object' && value[0] != null) {
        for (const key of Object.keys(value[0] as object)) {
          Object.defineProperty(accessor, key, {
            get: () =>
              createAccessor([...path, 0, key], (value[0] as Record<string, unknown>)[key]),
            enumerable: true,
          });
        }
      }
    } else if (value != null && typeof value === 'object') {
      for (const key of Object.keys(value)) {
        Object.defineProperty(accessor, key, {
          get: () => createAccessor([...path, key], (value as Record<string, unknown>)[key]),
          enumerable: true,
        });
      }
    }

    return accessor;
  };

  return new Proxy({} as UnboundFieldAccessors<T>, {
    get(_, prop: string) {
      const value = (template as Record<string, unknown>)[prop];
      return createAccessor([prop], value);
    },
  });
}
