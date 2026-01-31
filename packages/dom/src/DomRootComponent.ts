import { defineComponent } from '@ecs-test/ecs';

export const DomRootComponent = defineComponent<{
  root: Element;
  elementFactory: (tag: string) => Element;
}>('DomRoot');
