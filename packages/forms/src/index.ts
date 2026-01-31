/**
 * @ecs-test/forms - Type-safe form state management
 *
 * Pure TypeScript, zero dependencies. Can be used with any UI framework.
 *
 * @example
 * ```ts
 * type Author = { name: string; age: number; books: { title: string }[] };
 *
 * const AuthorForm = createFormFactory<Author>({
 *   initialValues: { name: "", age: 0, books: [] },
 *   validate: {
 *     name: (v) => !v ? "Required" : undefined,
 *   },
 *   computed: {
 *     // Define derived fields here
 *   }
 * });
 *
 * // Create instance for testing or use
 * const form = AuthorForm.create();
 * form.fields.name.set("Alice");
 * form.fields.books.append({ title: "My Book" });
 *
 * // Type-safe accessors
 * AuthorForm.fields.name           // For UI binding
 * AuthorForm.fields.books.at(0).title
 * ```
 */

export { createFormFactory } from './factory.ts';

export type {
  // Core types
  FormFactory,
  FormFactoryConfig,
  FormInstance,
  FormSubscriber,
  // Validation
  ValidateFn,
  ValidationSchema,
  ComputedSchema,
  // Accessors
  UnboundFieldAccessor,
  UnboundFieldAccessors,
  UnboundArrayAccessor,
  BoundFieldAccessor,
  BoundFieldAccessors,
  BoundArrayAccessor,
  BoundArrayItemAccessor,
} from './types.ts';
