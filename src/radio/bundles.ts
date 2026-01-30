/**
 * Radio group bundles.
 */

import { defineBundle, DOMElement, Clickable, TextContent } from "../../framework/index.ts";
import { Selection, Value, Radio, Name } from "./components.ts";

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
