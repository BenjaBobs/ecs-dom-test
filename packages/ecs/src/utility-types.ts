// @minimap summary: Defines shared recursive TypeScript utility types such as DeepReadonly used by the ECS and event APIs.
// @minimap tags: ecs utility-types DeepReadonly typescript helpers types
/**
 * Recursive Readonly<T>.
 */
export type DeepReadonly<T> = T extends (infer R)[]
  ? DeepReadonlyArray<R>
  : // biome-ignore lint/complexity/noBannedTypes: Need to filter out functions manually because they extend object
    T extends Function
    ? T
    : T extends object
      ? DeepReadonlyObject<T>
      : T;

interface DeepReadonlyArray<T> extends ReadonlyArray<DeepReadonly<T>> {}

type DeepReadonlyObject<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};
