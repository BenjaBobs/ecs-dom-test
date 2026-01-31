/**
 * @ecs-test/forms-ui - ECS/DOM bindings for forms
 *
 * Connects @ecs-test/forms to the ECS UI framework.
 *
 * @example
 * ```tsx
 * import { createFormFactory } from "@ecs-test/forms";
 * import { FormData, FormBinding, TextInput, registerFormSystems } from "@ecs-test/forms-ui";
 *
 * const AuthorForm = createFormFactory<Author>({ ... });
 * const f = AuthorForm.fields;
 *
 * registerFormSystems(world);
 *
 * <Entity>
 *   <FormData factory={AuthorForm} />
 *   <Entity>
 *     <DOMElement tag="input" />
 *     <TextInput />
 *     <FormBinding field={f.name} />
 *   </Entity>
 * </Entity>
 * ```
 */

// Components
export {
  FormData,
  FormBinding,
  FormDisplay,
  FieldError,
  TextInput,
  NumberInput,
  FormInstance,
} from './components.ts';

// Systems
export {
  FormDataInitSystem,
  TextInputBindingSystem,
  NumberInputBindingSystem,
  FormDisplaySystem,
  FieldErrorSystem,
  registerFormSystems,
} from './systems.ts';
