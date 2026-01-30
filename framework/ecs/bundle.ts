/**
 * Bundle definitions - reusable groups of components.
 */

import type { ComponentInstance, ComponentRef } from "./component.ts";
import { getTag } from "./component.ts";

/** Bundle result with component instances */
export type BundleResult = {
  _isBundle: true;
  components: ComponentInstance[];
};

/** Bundle function type */
export type BundleFn<P> = (
  props: P & { except?: ComponentRef[]; only?: ComponentRef[] }
) => BundleResult;

/**
 * Define a bundle - a reusable group of components.
 *
 * @example
 * const RadioOption = defineBundle(({ value }: { value: string }) => [
 *   Clickable(),
 *   Value({ of: value }),
 * ]);
 *
 * // Usage with except:
 * RadioOption({ value: "a", except: [Clickable] })
 */
export function defineBundle<P extends Record<string, unknown>>(
  fn: (props: P) => ComponentInstance[]
): BundleFn<P> {
  return (
    props: P & { except?: ComponentRef[]; only?: ComponentRef[] }
  ): BundleResult => {
    const { except, only, ...rest } = props;
    let components = fn(rest as P);

    if (only && only.length > 0) {
      const onlyTags = only.map(getTag);
      components = components.filter((c) => onlyTags.includes(c._tag));
    } else if (except && except.length > 0) {
      const exceptTags = except.map(getTag);
      components = components.filter((c) => !exceptTags.includes(c._tag));
    }

    return {
      _isBundle: true,
      components,
    };
  };
}

/** Check if a value is a bundle result */
export function isBundle(value: unknown): value is BundleResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "_isBundle" in value &&
    value._isBundle === true
  );
}
