export type CodeMode = 'jsx' | 'nonjsx';

export type LiveExample = {
  title: string;
  codeByMode: Partial<Record<CodeMode, string>>;
};

const MANUAL_NONJSX = `import { World } from '/playground/modules/ecs.js';
import { DOMElement, TextContent, Classes, registerDOMSystems } from '/playground/modules/dom.js';

const world = new World({
  externals: {
    createElement: document.createElement.bind(document),
    rootContainer: document.getElementById('root'),
    window,
    console,
  },
});

registerDOMSystems(world);

const card = world.createEntity();
world.add(card, DOMElement({ tag: 'div' }));
world.add(card, Classes({ list: ['live-card'] }));

const title = world.createEntity(card);
world.add(title, DOMElement({ tag: 'h3' }));
world.add(title, TextContent({ value: 'Hello from a live editor' }));

const body = world.createEntity(card);
world.add(body, DOMElement({ tag: 'p' }));
world.add(body, TextContent({ value: 'Edit this code and the iframe updates.' }));

world.flush();
`;

const MANUAL_JSX = `import { World, Entity, materialize } from '/playground/modules/ecs.js';
import { DOMElement, TextContent, Classes, registerDOMSystems } from '/playground/modules/dom.js';

const world = new World({
  externals: {
    createElement: document.createElement.bind(document),
    rootContainer: document.getElementById('root'),
    window,
    console,
  },
});

registerDOMSystems(world);

const ui = (
  <Entity>
    <DOMElement tag="div" />
    <Classes list={['live-card']} />

    <Entity>
      <DOMElement tag="h3" />
      <TextContent value="Hello from a live editor" />
    </Entity>

    <Entity>
      <DOMElement tag="p" />
      <TextContent value="Edit this code and the iframe updates." />
    </Entity>
  </Entity>
);

materialize(world, ui);
world.flush();
`;

const COUNTER_NONJSX = `import {
  World,
  defineComponent,
  defineMarker,
  defineReactiveSystem,
  Entities,
} from '/playground/modules/ecs.js';
import {
  DOMElement,
  TextContent,
  Classes,
  Clickable,
  Clicked,
  Disabled,
  registerDOMSystems,
} from '/playground/modules/dom.js';

const Count = defineComponent('Count');
const CounterState = defineMarker('CounterState');
const CounterLabel = defineMarker('CounterLabel');
const IncrementButton = defineMarker('IncrementButton');
const DecrementButton = defineMarker('DecrementButton');

const world = new World({
  externals: {
    createElement: document.createElement.bind(document),
    rootContainer: document.getElementById('root'),
    window,
    console,
  },
});

registerDOMSystems(world);

const CounterClickSystem = defineReactiveSystem({
  name: 'CounterClickSystem',
  query: Entities.with([Clicked]),
  onEnter(world, entities) {
    const stateEntity = world.query(CounterState)[0];
    if (stateEntity == null) return;
    const current = world.get(stateEntity, Count)?.value ?? 0;
    let next = current;

    for (const entity of entities) {
      if (world.has(entity, IncrementButton)) {
        next += 1;
      } else if (world.has(entity, DecrementButton)) {
        next = Math.max(0, next - 1);
      }
      world.remove(entity, Clicked);
    }

    world.set(stateEntity, Count({ value: next }));
  },
});

const CounterRenderSystem = defineReactiveSystem({
  name: 'CounterRenderSystem',
  query: Entities.with([Count]),
  onEnter(world) {
    const stateEntity = world.query(CounterState)[0];
    if (stateEntity == null) return;
    const value = world.get(stateEntity, Count)?.value ?? 0;
    const label = world.query(CounterLabel)[0];
    const decButton = world.query(DecrementButton)[0];

    if (label != null) {
      world.set(label, TextContent({ value: value + ' tasks completed' }));
    }

    if (decButton != null) {
      if (value <= 0) {
        if (!world.has(decButton, Disabled)) {
          world.add(decButton, Disabled());
        }
      } else {
        world.remove(decButton, Disabled);
      }
    }
  },
  onUpdate(world) {
    const stateEntity = world.query(CounterState)[0];
    if (stateEntity == null) return;
    const value = world.get(stateEntity, Count)?.value ?? 0;
    const label = world.query(CounterLabel)[0];
    const decButton = world.query(DecrementButton)[0];

    if (label != null) {
      world.set(label, TextContent({ value: value + ' tasks completed' }));
    }

    if (decButton != null) {
      if (value <= 0) {
        if (!world.has(decButton, Disabled)) {
          world.add(decButton, Disabled());
        }
      } else {
        world.remove(decButton, Disabled);
      }
    }
  },
});

world.registerSystem(CounterClickSystem);
world.registerSystem(CounterRenderSystem);

const card = world.createEntity();
world.add(card, DOMElement({ tag: 'section' }));
world.add(card, Classes({ list: ['live-card', 'task-counter'] }));

const title = world.createEntity(card);
world.add(title, DOMElement({ tag: 'h3' }));
world.add(title, TextContent({ value: 'Task Counter' }));

const label = world.createEntity(card);
world.add(label, DOMElement({ tag: 'p' }));
world.add(label, CounterLabel());

const controls = world.createEntity(card);
world.add(controls, DOMElement({ tag: 'div' }));
world.add(controls, Classes({ list: ['controls'] }));

const dec = world.createEntity(controls);
world.add(dec, DOMElement({ tag: 'button' }));
world.add(dec, TextContent({ value: '-1' }));
world.add(dec, Clickable());
world.add(dec, DecrementButton());

const inc = world.createEntity(controls);
world.add(inc, DOMElement({ tag: 'button' }));
world.add(inc, TextContent({ value: '+1' }));
world.add(inc, Clickable());
world.add(inc, IncrementButton());

const state = world.createEntity();
world.add(state, CounterState());
world.add(state, Count({ value: 0 }));
world.flush();
`;

const COUNTER_JSX = `import {
  World,
  Entity,
  materialize,
  defineComponent,
  defineMarker,
  defineReactiveSystem,
  Entities,
} from '/playground/modules/ecs.js';
import {
  DOMElement,
  TextContent,
  Classes,
  Clickable,
  Clicked,
  Disabled,
  registerDOMSystems,
} from '/playground/modules/dom.js';

const Count = defineComponent('Count');
const CounterState = defineMarker('CounterState');
const CounterLabel = defineMarker('CounterLabel');
const IncrementButton = defineMarker('IncrementButton');
const DecrementButton = defineMarker('DecrementButton');

const world = new World({
  externals: {
    createElement: document.createElement.bind(document),
    rootContainer: document.getElementById('root'),
    window,
    console,
  },
});

registerDOMSystems(world);

const CounterClickSystem = defineReactiveSystem({
  name: 'CounterClickSystem',
  query: Entities.with([Clicked]),
  onEnter(world, entities) {
    const stateEntity = world.query(CounterState)[0];
    if (stateEntity == null) return;
    const current = world.get(stateEntity, Count)?.value ?? 0;
    let next = current;

    for (const entity of entities) {
      if (world.has(entity, IncrementButton)) {
        next += 1;
      } else if (world.has(entity, DecrementButton)) {
        next = Math.max(0, next - 1);
      }
      world.remove(entity, Clicked);
    }

    world.set(stateEntity, Count({ value: next }));
  },
});

const CounterRenderSystem = defineReactiveSystem({
  name: 'CounterRenderSystem',
  query: Entities.with([Count]),
  onEnter(world) {
    const stateEntity = world.query(CounterState)[0];
    if (stateEntity == null) return;
    const value = world.get(stateEntity, Count)?.value ?? 0;
    const label = world.query(CounterLabel)[0];
    const decButton = world.query(DecrementButton)[0];

    if (label != null) {
      world.set(label, TextContent({ value: value + ' tasks completed' }));
    }

    if (decButton != null) {
      if (value <= 0) {
        if (!world.has(decButton, Disabled)) {
          world.add(decButton, Disabled());
        }
      } else {
        world.remove(decButton, Disabled);
      }
    }
  },
  onUpdate(world) {
    const stateEntity = world.query(CounterState)[0];
    if (stateEntity == null) return;
    const value = world.get(stateEntity, Count)?.value ?? 0;
    const label = world.query(CounterLabel)[0];
    const decButton = world.query(DecrementButton)[0];

    if (label != null) {
      world.set(label, TextContent({ value: value + ' tasks completed' }));
    }

    if (decButton != null) {
      if (value <= 0) {
        if (!world.has(decButton, Disabled)) {
          world.add(decButton, Disabled());
        }
      } else {
        world.remove(decButton, Disabled);
      }
    }
  },
});

world.registerSystem(CounterClickSystem);
world.registerSystem(CounterRenderSystem);

const ui = (
  <Entity>
    <DOMElement tag="section" />
    <Classes list={['live-card', 'task-counter']} />

    <Entity>
      <DOMElement tag="h3" />
      <TextContent value="Task Counter" />
    </Entity>

    <Entity>
      <DOMElement tag="p" />
      <CounterLabel />
    </Entity>

    <Entity>
      <DOMElement tag="div" />
      <Classes list={['controls']} />

      <Entity>
        <DOMElement tag="button" />
        <TextContent value="-1" />
        <Clickable />
        <DecrementButton />
      </Entity>

      <Entity>
        <DOMElement tag="button" />
        <TextContent value="+1" />
        <Clickable />
        <IncrementButton />
      </Entity>
    </Entity>

    <Entity>
      <CounterState />
      <Count value={0} />
    </Entity>
  </Entity>
);

materialize(world, ui);
world.flush();
`;

export const LIVE_EXAMPLES: Record<string, LiveExample> = {
  'manual-button': {
    title: 'Live Example',
    codeByMode: {
      jsx: MANUAL_JSX,
      nonjsx: MANUAL_NONJSX,
    },
  },
  'task-counter': {
    title: 'Task Counter App',
    codeByMode: {
      jsx: COUNTER_JSX,
      nonjsx: COUNTER_NONJSX,
    },
  },
};
