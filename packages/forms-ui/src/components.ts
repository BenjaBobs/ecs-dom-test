/**
 * Form UI components for ECS.
 */

import { defineComponent, defineMarker } from "@ecs-test/ecs";
import type { FormFactory, UnboundFieldAccessor } from "@ecs-test/forms";

/**
 * Attaches a form factory to an entity, creating an instance.
 * Child entities can use FormBinding to connect to this form.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FormData = defineComponent<{ factory: FormFactory<any> }>("FormData");

/**
 * Binds an input element to a form field.
 * Must have a FormData ancestor in the entity hierarchy.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FormBinding = defineComponent<{ field: UnboundFieldAccessor<any, any> }>("FormBinding");

/**
 * Displays a form field value (read-only).
 * Must have a FormData ancestor in the entity hierarchy.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FormDisplay = defineComponent<{ field: UnboundFieldAccessor<any, any> }>("FormDisplay");

/**
 * Displays validation error for a form field.
 * Only shows error if field is touched and has an error.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FieldError = defineComponent<{ field: UnboundFieldAccessor<any, any> }>("FieldError");

/**
 * Marker for text input elements.
 */
export const TextInput = defineMarker("TextInput");

/**
 * Marker for number input elements.
 */
export const NumberInput = defineMarker("NumberInput");

/**
 * Internal: Stores the resolved form instance on a FormData entity.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FormInstance = defineComponent<{ instance: import("@ecs-test/forms").FormInstance<any> }>("FormInstance");

/**
 * Internal: Marks an entity as needing form binding resolution.
 */
export const NeedsFormResolution = defineMarker("NeedsFormResolution");
