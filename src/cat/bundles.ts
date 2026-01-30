/**
 * Cat fetcher bundles.
 */

import { defineBundle, DOMElement, Clickable, TextContent, Classes } from "../../framework/index.ts";
import { FetchCatButton, CatDisplayMarker } from "./components.ts";

/**
 * FetchCatBtn bundle - a button that triggers cat fetch on parent CatDisplay.
 */
export const FetchCatBtn = defineBundle(({ label }: { label: string }) => [
  DOMElement({ tag: "button" }),
  Clickable(),
  TextContent({ value: label }),
  FetchCatButton(),
]);

/**
 * CatDisplay bundle - container for displaying a cat.
 */
export const CatDisplay = defineBundle(() => [
  DOMElement({ tag: "div" }),
  Classes({ list: ["cat-display"] }),
  CatDisplayMarker(),
]);
