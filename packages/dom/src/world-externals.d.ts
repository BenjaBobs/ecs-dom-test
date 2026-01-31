export {};

declare module '@ecs-test/ecs' {
  interface WorldExternals {
    createElement?: (tag: string) => Element;
  }
}
