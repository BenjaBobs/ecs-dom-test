/**
 * Author form UI components.
 */

import { Entity } from "@ecs-test/ecs";
import { DOMElement, Classes, TextContent, Clickable } from "@ecs-test/dom";
import {
  FormData,
  FormBinding,
  FormDisplay,
  FieldError,
  TextInput,
  NumberInput,
} from "@ecs-test/forms-ui";
import { AuthorForm, f } from "./form.ts";

/**
 * Complete Author form UI.
 */
export function AuthorFormUI() {
  return (
    <Entity>
      <DOMElement tag="div" />
      <Classes list={["author-form"]} />
      <FormData factory={AuthorForm} />

      {/* Header */}
      <Entity>
        <DOMElement tag="h2" />
        <TextContent value="Author Form" />
      </Entity>

      {/* Name field */}
      <Entity>
        <DOMElement tag="div" />
        <Classes list={["field"]} />

        <Entity>
          <DOMElement tag="label" />
          <TextContent value="Name" />
        </Entity>

        <Entity>
          <DOMElement tag="input" />
          <TextInput />
          <FormBinding field={f.name} />
        </Entity>

        <Entity>
          <DOMElement tag="span" />
          <Classes list={["error"]} />
          <FieldError field={f.name} />
        </Entity>
      </Entity>

      {/* Age field */}
      <Entity>
        <DOMElement tag="div" />
        <Classes list={["field"]} />

        <Entity>
          <DOMElement tag="label" />
          <TextContent value="Age" />
        </Entity>

        <Entity>
          <DOMElement tag="input" />
          <NumberInput />
          <FormBinding field={f.age} />
        </Entity>

        <Entity>
          <DOMElement tag="span" />
          <Classes list={["error"]} />
          <FieldError field={f.age} />
        </Entity>
      </Entity>

      {/* Average score (computed, read-only) */}
      <Entity>
        <DOMElement tag="div" />
        <Classes list={["field", "computed"]} />

        <Entity>
          <DOMElement tag="label" />
          <TextContent value="Average Review Score" />
        </Entity>

        <Entity>
          <DOMElement tag="span" />
          <Classes list={["value"]} />
          <FormDisplay field={f.averageReviewScore} />
        </Entity>
      </Entity>

      {/* Books section */}
      <Entity>
        <DOMElement tag="div" />
        <Classes list={["books-section"]} />

        <Entity>
          <DOMElement tag="h3" />
          <TextContent value="Books" />
        </Entity>

        <Entity>
          <DOMElement tag="span" />
          <Classes list={["error"]} />
          <FieldError field={f.books} />
        </Entity>

        {/* Book list will be rendered dynamically by a system */}
        <Entity>
          <DOMElement tag="div" />
          <Classes list={["book-list"]} />
          <BookListMarker />
        </Entity>

        {/* Add book button */}
        <Entity>
          <DOMElement tag="button" />
          <TextContent value="+ Add Book" />
          <Clickable />
          <AddBookButton />
        </Entity>
      </Entity>

      {/* Submit button */}
      <Entity>
        <DOMElement tag="button" />
        <Classes list={["submit"]} />
        <TextContent value="Submit" />
        <Clickable />
        <SubmitButton />
      </Entity>
    </Entity>
  );
}

// Markers and components for the systems to identify special entities
import { defineMarker, defineComponent } from "@ecs-test/ecs";

export const BookListMarker = defineMarker("BookListMarker");
export const AddBookButton = defineMarker("AddBookButton");
export const SubmitButton = defineMarker("SubmitButton");
export const BookItem = defineComponent<{ index: number; key: string }>(
  "BookItem"
);
export const RemoveBookButton = defineMarker("RemoveBookButton");
