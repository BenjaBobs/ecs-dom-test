/**
 * Radio group components.
 */

import { defineComponent, defineMarker } from "@ecs-test/ecs";

/** Marks an entity as managing selection among its children */
export const Selection = defineMarker("Selection");

/** The currently selected value */
export const SelectedValue = defineComponent<{ value: string }>("SelectedValue");

/** A selectable value on a child entity */
export const Value = defineComponent<{ of: string }>("Value");

/** Marks a child as currently selected */
export const Selected = defineMarker("Selected");

/** Radio indicator component (for styling) */
export const Radio = defineMarker("Radio");

/** Named label (e.g., for fieldset legend) */
export const Name = defineComponent<{ value: string }>("Name");
