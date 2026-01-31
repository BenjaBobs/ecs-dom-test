/**
 * Author form systems - handle dynamic book list and form actions.
 */

import {
  type World,
  type EntityId,
  type ComponentRef,
  defineReactiveSystem,
  added,
} from "@ecs-test/ecs";
import {
  DOMElement,
  Classes,
  TextContent,
  Clickable,
  Clicked,
  Draggable,
  Droppable,
  Dropped,
  getDOMElement,
} from "@ecs-test/dom";
import {
  FormData,
  FormBinding,
  FieldError,
  TextInput,
  NumberInput,
  FormInstance,
} from "@ecs-test/forms-ui";
import type { FormInstance as FormInstanceType } from "@ecs-test/forms";
import {
  BookListMarker,
  AddBookButton,
  SubmitButton,
  BookItem,
  RemoveBookButton,
} from "./ui.tsx";
import { f, type Author } from "./form.ts";

/**
 * Handles Add Book button clicks.
 */
const AddBookClickSystem = defineReactiveSystem({
  triggers: [added(Clicked)],
  filter: [AddBookButton],
  execute(entities, world) {
    for (const entity of entities) {
      world.remove(entity, Clicked);

      // Find the form instance
      const formDataEntity = findAncestorWith(entity, FormData, world);
      if (!formDataEntity) continue;

      const formInstance = world.get(formDataEntity, FormInstance);
      if (!formInstance) continue;

      // Add a new book
      const instance = formInstance.instance as FormInstanceType<Author>;
      instance.fields.books.append({ title: "", reviewScore: 3 });

      // Trigger re-render of book list
      rerenderBookList(world, formDataEntity, instance);
    }
  },
});

/**
 * Handles Submit button clicks.
 */
const SubmitClickSystem = defineReactiveSystem({
  triggers: [added(Clicked)],
  filter: [SubmitButton],
  execute(entities, world) {
    for (const entity of entities) {
      world.remove(entity, Clicked);

      // Find the form instance
      const formDataEntity = findAncestorWith(entity, FormData, world);
      if (!formDataEntity) continue;

      const formInstance = world.get(formDataEntity, FormInstance);
      if (!formInstance) continue;

      const instance = formInstance.instance as FormInstanceType<Author>;
      const result = instance.submit();

      if (result.ok) {
        console.log("Form submitted successfully!", result.data);
        alert(`Author: ${result.data.name}, ${result.data.age} years old, ${result.data.books.length} books, avg score: ${result.data.averageReviewScore}`);
      } else {
        console.log("Form validation failed:", Object.fromEntries(result.errors));
      }

      // Trigger re-render to show errors
      world.flush();
    }
  },
});

/**
 * Handles Remove Book button clicks.
 */
const RemoveBookClickSystem = defineReactiveSystem({
  triggers: [added(Clicked)],
  filter: [RemoveBookButton],
  execute(entities, world) {
    for (const entity of entities) {
      world.remove(entity, Clicked);

      // Get the book index from the component
      const removeBtn = world.get(entity, RemoveBookButton);
      if (!removeBtn) continue;

      // Find the form instance
      const formDataEntity = findAncestorWith(entity, FormData, world);
      if (!formDataEntity) continue;

      const formInstance = world.get(formDataEntity, FormInstance);
      if (!formInstance) continue;

      const instance = formInstance.instance as FormInstanceType<Author>;

      // Find which book this is - look for BookItem ancestor
      const bookItemEntity = findAncestorWith(entity, BookItem, world);
      if (!bookItemEntity) continue;

      const bookItem = world.get(bookItemEntity, BookItem);
      if (!bookItem || typeof bookItem.index !== "number") continue;

      const index = bookItem.index;
      instance.fields.books.remove(index);

      // Trigger re-render of book list
      rerenderBookList(world, formDataEntity, instance);
    }
  },
});

/**
 * Initial render of book list when FormData is added.
 */
const BookListInitSystem = defineReactiveSystem({
  triggers: [added(FormInstance)],
  filter: [FormData],
  execute(entities, world) {
    for (const entity of entities) {
      const formInstance = world.get(entity, FormInstance);
      if (!formInstance) continue;

      const instance = formInstance.instance as FormInstanceType<Author>;

      // Subscribe to form changes to re-render book list
      instance.subscribe(() => {
        // Entity may have been removed
        if (!world.exists(entity)) return;

        rerenderBookList(world, entity, instance);
        world.flush();
      });

      // Initial render
      rerenderBookList(world, entity, instance);
    }
  },
});

/**
 * Re-render the book list based on current form state.
 */
function rerenderBookList(world: World, formDataEntity: EntityId, instance: FormInstanceType<Author>): void {
  // Find the BookListMarker entity
  const bookListEntity = findDescendantWith(formDataEntity, BookListMarker, world);
  if (!bookListEntity) return;

  // Remove existing book items
  const existingBooks = world.getChildren(bookListEntity).filter(
    child => world.has(child, BookItem)
  );
  for (const existing of existingBooks) {
    world.removeEntity(existing);
  }

  // Create new book items
  const books = instance.fields.books;
  let index = 0;
  for (const book of books) {
    createBookItemEntity(world, bookListEntity, formDataEntity, index, book.key);
    index++;
  }
}

/**
 * Create a book item entity with all its children.
 */
function createBookItemEntity(
  world: World,
  parent: EntityId,
  formDataEntity: EntityId,
  index: number,
  key: string
): void {
  // Book item container
  const bookEntity = world.createEntity(parent);
  world.add(bookEntity, DOMElement({ tag: "div" }));
  world.add(bookEntity, Classes({ list: ["book-item"] }));
  world.add(bookEntity, BookItem({ index, key }));
  world.add(bookEntity, Draggable({ type: "book", data: { index, key } }));
  world.add(bookEntity, Droppable({ accepts: ["book"] }));

  // Title field
  const titleField = world.createEntity(bookEntity);
  world.add(titleField, DOMElement({ tag: "div" }));
  world.add(titleField, Classes({ list: ["field"] }));

  const titleLabel = world.createEntity(titleField);
  world.add(titleLabel, DOMElement({ tag: "label" }));
  world.add(titleLabel, TextContent({ value: "Title" }));

  const titleInput = world.createEntity(titleField);
  world.add(titleInput, DOMElement({ tag: "input" }));
  world.add(titleInput, TextInput());
  world.add(titleInput, FormBinding({ field: f.books.at(index).title }));

  const titleError = world.createEntity(titleField);
  world.add(titleError, DOMElement({ tag: "span" }));
  world.add(titleError, Classes({ list: ["error"] }));
  world.add(titleError, FieldError({ field: f.books.at(index).title }));

  // Score field
  const scoreField = world.createEntity(bookEntity);
  world.add(scoreField, DOMElement({ tag: "div" }));
  world.add(scoreField, Classes({ list: ["field"] }));

  const scoreLabel = world.createEntity(scoreField);
  world.add(scoreLabel, DOMElement({ tag: "label" }));
  world.add(scoreLabel, TextContent({ value: "Score (1-5)" }));

  const scoreInput = world.createEntity(scoreField);
  world.add(scoreInput, DOMElement({ tag: "input" }));
  world.add(scoreInput, NumberInput());
  world.add(scoreInput, FormBinding({ field: f.books.at(index).reviewScore }));

  const scoreError = world.createEntity(scoreField);
  world.add(scoreError, DOMElement({ tag: "span" }));
  world.add(scoreError, Classes({ list: ["error"] }));
  world.add(scoreError, FieldError({ field: f.books.at(index).reviewScore }));

  // Remove button
  const removeBtn = world.createEntity(bookEntity);
  world.add(removeBtn, DOMElement({ tag: "button" }));
  world.add(removeBtn, TextContent({ value: "Remove" }));
  world.add(removeBtn, Clickable());
  world.add(removeBtn, RemoveBookButton());
}

/**
 * Handles book reordering via drag and drop.
 */
const BookDropSystem = defineReactiveSystem({
  triggers: [added(Dropped)],
  filter: [BookItem],
  execute(entities, world) {
    for (const entity of entities) {
      const dropped = world.get(entity, Dropped);
      world.remove(entity, Dropped);

      if (!dropped || dropped.type !== "book") continue;

      const targetBookItem = world.get(entity, BookItem);
      if (!targetBookItem) continue;

      const sourceData = dropped.data as { index: number; key: string };
      const fromIndex = sourceData.index;
      const toIndex = targetBookItem.index;

      // Don't do anything if dropped on self
      if (fromIndex === toIndex) continue;

      // Find the form instance
      const formDataEntity = findAncestorWith(entity, FormData, world);
      if (!formDataEntity) continue;

      const formInstance = world.get(formDataEntity, FormInstance);
      if (!formInstance) continue;

      const instance = formInstance.instance as FormInstanceType<Author>;
      instance.fields.books.move(fromIndex, toIndex);

      // Trigger re-render of book list
      rerenderBookList(world, formDataEntity, instance);
    }
  },
});

/**
 * Register all author form systems.
 */
export function registerAuthorSystems(world: World): void {
  world.registerSystem(BookListInitSystem);
  world.registerSystem(AddBookClickSystem);
  world.registerSystem(RemoveBookClickSystem);
  world.registerSystem(SubmitClickSystem);
  world.registerSystem(BookDropSystem);
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

function findDescendantWith(
  entity: EntityId,
  component: ComponentRef,
  world: World
): EntityId | undefined {
  const stack = [...world.getChildren(entity)];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (world.has(current, component)) {
      return current;
    }
    stack.push(...world.getChildren(current));
  }
  return undefined;
}
