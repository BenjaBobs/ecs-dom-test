/**
 * Radio group bundles.
 */

import { defineBundle } from "@ecs-test/ecs";
import { DOMElement, Clickable, TextContent, Classes } from "@ecs-test/dom";
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
  DOMElement({ tag: "span" }),
  Classes({ list: ["radio"] }),
  Radio(),
]);

/**
 * TextSpan bundle - a span element containing text.
 */
export const TextSpan = defineBundle(({ content }: { content: string }) => [
  DOMElement({ tag: "span" }),
  TextContent({ value: content }),
]);
