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

const card = world.createEntity(undefined, [DOMElement({ tag: 'div' }), Classes({ list: ['live-card'] })]);

const title = world.createEntity(card, [DOMElement({ tag: 'h3' }), TextContent({ value: 'Hello from a live editor' })]);

const body = world.createEntity(card, [DOMElement({ tag: 'p' }), TextContent({ value: 'Edit this code and the iframe updates.' })]);

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

const TODO_NONJSX = `import {
  World,
  defineComponent,
  defineEvent,
  defineMarker,
  defineReactiveSystem,
  Entities,
} from '/playground/modules/ecs.js';
import {
  DOMElement,
  TextContent,
  Classes,
  Style,
  Clickable,
  registerDOMSystems,
  getDOMElement,
} from '/playground/modules/dom.js';

// ── Components ──────────────────────────────────────────
// TodoText holds the text for a single todo item.
// Status stores completion state.
const TodoText = defineComponent<{ value: string }>('TodoText');
const Status = defineComponent<{ completed: boolean }>('Status');
const TodoInput = defineMarker('TodoInput');
const TodoListContainer = defineMarker('TodoListContainer');
const TodoToggleButton = defineMarker('TodoToggleButton');
const TodoLabel = defineMarker('TodoLabel');
const TodoToggleRequested = defineEvent('todo.toggleRequested');
const TodoRemoveRequested = defineEvent('todo.removeRequested');

// ── World setup ─────────────────────────────────────────
const world = new World({
  externals: {
    // The world needs these to create and mount DOM elements
    createElement: document.createElement.bind(document),
    rootContainer: document.getElementById('root'),
    window,
    console,
  },
});
registerDOMSystems(world);

// ── Helpers: row rendering + updates ─────────────────────
function buildTodoRow(world, todoEntity) {
  const text = world.get(todoEntity, TodoText)?.value ?? '';

  world.createEntity(todoEntity, [
    DOMElement({ tag: 'button' }),
    TodoToggleButton(),
    TextContent({ value: '\\u2610' }),
    Style({ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer', padding: '0' }),
    Clickable({ onClick: (world, entity) => {
      world.emit(entity, TodoToggleRequested);
    }}),
  ]);

  world.createEntity(todoEntity, [
    DOMElement({ tag: 'span' }),
    TodoLabel(),
    TextContent({ value: text }),
    Style({ flex: '1', textDecoration: 'none', opacity: '1' }),
  ]);

  world.createEntity(todoEntity, [
    DOMElement({ tag: 'button' }),
    TextContent({ value: 'Remove' }),
    Style({ border: 'none', background: 'none', color: '#ef4444', fontSize: '18px', cursor: 'pointer', padding: '0 4px' }),
    Clickable({ onClick: (world, entity) => {
      world.emit(entity, TodoRemoveRequested);
    }}),
  ]);
}

function updateTodoVisuals(world, todoEntity) {
  const done = world.get(todoEntity, Status)?.completed ?? false;

  const toggle = world.findChildMaybe(todoEntity, TodoToggleButton);
  if (toggle != null) {
    world.set(toggle, TextContent({ value: done ? '\\u2611' : '\\u2610' }));
  }

  const label = world.findChildMaybe(todoEntity, TodoLabel);
  if (label != null) {
    world.set(label, Style({
      flex: '1',
      textDecoration: done ? 'line-through' : 'none',
      opacity: done ? '0.5' : '1',
    }));
  }
}

// ── Systems ─────────────────────────────────────────────

// When a TodoText entity first appears, set up its row DOM and children.
const TodoEnterSystem = defineReactiveSystem({
  name: 'TodoEnterSystem',
  query: Entities.with([TodoText]),
  onEnter(world, entities) {
    for (const entity of entities) {
      world.add(entity, DOMElement({ tag: 'div' }));
      world.add(entity, Style({
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 0', borderBottom: '1px solid #e5e7eb',
      }));
      buildTodoRow(world, entity);
      updateTodoVisuals(world, entity);

      world.on(entity, TodoToggleRequested, () => {
        const status = world.get(entity, Status) ?? { completed: false };
        world.set(entity, Status({ completed: !status.completed }));
        updateTodoVisuals(world, entity);
      });

      world.on(entity, TodoRemoveRequested, () => {
        world.removeEntity(entity);
      });
    }
  },
});

world.registerSystem(TodoEnterSystem);

// ── Helper: add a todo from the input field ─────────────
function addTodoFromInput(world) {
  const inputEntity = world.query(TodoInput)[0];
  if (inputEntity == null) return;
  const inputEl = getDOMElement(world, inputEntity) as HTMLInputElement | undefined;
  if (!inputEl) return;

  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';

  const listEntity = world.query(TodoListContainer)[0];
  if (listEntity == null) return;
  world.createEntity(listEntity, [TodoText({ value: text }), Status({ completed: false })]);
}

// ── Build the static UI shell ───────────────────────────
const card = world.createEntity(undefined, [DOMElement({ tag: 'section' }), Classes({ list: ['live-card'] })]);

world.createEntity(card, [DOMElement({ tag: 'h3' }), TextContent({ value: 'Todo List' })]);

const form = world.createEntity(card, [
  DOMElement({ tag: 'div' }),
  Style({ display: 'flex', gap: '8px', marginBottom: '12px' }),
]);

const input = world.createEntity(form, [
  DOMElement({ tag: 'input' }),
  TodoInput(),
  Style({ flex: '1', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', font: 'inherit' }),
]);

// Add button — onClick reads the input and creates a new todo entity
world.createEntity(form, [
  DOMElement({ tag: 'button' }),
  TextContent({ value: 'Add' }),
  Clickable({ onClick: (world) => addTodoFromInput(world) }),
]);

const list = world.createEntity(card, [DOMElement({ tag: 'div' }), TodoListContainer()]);

// ── Seed initial todos ──────────────────────────────────
// Each todo is an entity with TodoText and Status, parented under the list container.
world.createEntity(list, [TodoText({ value: 'Learn about ECS entities' }), Status({ completed: true })]);
world.createEntity(list, [TodoText({ value: 'Build a todo app' }), Status({ completed: false })]);
world.createEntity(list, [TodoText({ value: 'Try the live editor' }), Status({ completed: false })]);

world.flush();

// Let Enter key add todos too
getDOMElement(world, input)?.addEventListener('keydown', (e) => {
  if ((e as KeyboardEvent).key === 'Enter') {
    addTodoFromInput(world);
    world.flush();
  }
});
`;

const TODO_JSX = `import {
  World,
  Entity,
  materialize,
  defineComponent,
  defineEvent,
  defineMarker,
  defineReactiveSystem,
  Entities,
} from '/playground/modules/ecs.js';
import {
  DOMElement,
  TextContent,
  Classes,
  Style,
  Clickable,
  registerDOMSystems,
  getDOMElement,
} from '/playground/modules/dom.js';

// ── Components ──────────────────────────────────────────
// TodoText holds the text for a single todo item.
// Status stores completion state.
const TodoText = defineComponent<{ value: string }>('TodoText');
const Status = defineComponent<{ completed: boolean }>('Status');
const TodoInput = defineMarker('TodoInput');
const TodoListContainer = defineMarker('TodoListContainer');
const TodoToggleButton = defineMarker('TodoToggleButton');
const TodoLabel = defineMarker('TodoLabel');
const TodoToggleRequested = defineEvent('todo.toggleRequested');
const TodoRemoveRequested = defineEvent('todo.removeRequested');

// ── World setup ─────────────────────────────────────────
const world = new World({
  externals: {
    // The world needs these to create and mount DOM elements
    createElement: document.createElement.bind(document),
    rootContainer: document.getElementById('root'),
    window,
    console,
  },
});
registerDOMSystems(world);

// ── Helpers: row rendering + updates ─────────────────────
function buildTodoRow(world, todoEntity) {
  const text = world.get(todoEntity, TodoText)?.value ?? '';

  materialize(world, [
    <Entity>
      <DOMElement tag="button" />
      <TodoToggleButton />
      <TextContent value={'\\u2610'} />
      <Style border="none" background="none" fontSize="18px" cursor="pointer" padding="0" />
      <Clickable onClick={(world, entity) => {
        world.emit(entity, TodoToggleRequested);
      }} />
    </Entity>,

    <Entity>
      <DOMElement tag="span" />
      <TodoLabel />
      <TextContent value={text} />
      <Style flex="1" textDecoration="none" opacity="1" />
    </Entity>,

    <Entity>
      <DOMElement tag="button" />
      <TextContent value="Remove" />
      <Style border="none" background="none" color="#ef4444"
             fontSize="18px" cursor="pointer" padding="0 4px" />
      <Clickable onClick={(world, entity) => {
        world.emit(entity, TodoRemoveRequested);
      }} />
    </Entity>,
  ], todoEntity);
}

function updateTodoVisuals(world, todoEntity) {
  const done = world.get(todoEntity, Status)?.completed ?? false;

  const toggle = world.findChildMaybe(todoEntity, TodoToggleButton);
  if (toggle != null) {
    world.set(toggle, TextContent({ value: done ? '\\u2611' : '\\u2610' }));
  }

  const label = world.findChildMaybe(todoEntity, TodoLabel);
  if (label != null) {
    world.set(label, Style({
      flex: '1',
      textDecoration: done ? 'line-through' : 'none',
      opacity: done ? '0.5' : '1',
    }));
  }
}

// ── Systems ─────────────────────────────────────────────

// When a TodoText entity first appears, set up its row DOM and children.
const TodoEnterSystem = defineReactiveSystem({
  name: 'TodoEnterSystem',
  query: Entities.with([TodoText]),
  onEnter(world, entities) {
    for (const entity of entities) {
      world.add(entity, DOMElement({ tag: 'div' }));
      world.add(entity, Style({
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 0', borderBottom: '1px solid #e5e7eb',
      }));
      buildTodoRow(world, entity);
      updateTodoVisuals(world, entity);

      world.on(entity, TodoToggleRequested, () => {
        const status = world.get(entity, Status) ?? { completed: false };
        world.set(entity, Status({ completed: !status.completed }));
        updateTodoVisuals(world, entity);
      });

      world.on(entity, TodoRemoveRequested, () => {
        world.removeEntity(entity);
      });
    }
  },
});

world.registerSystem(TodoEnterSystem);

// ── Helper: add a todo from the input field ─────────────
function addTodoFromInput(world) {
  const inputEntity = world.query(TodoInput)[0];
  if (inputEntity == null) return;
  const inputEl = getDOMElement(world, inputEntity) as HTMLInputElement | undefined;
  if (!inputEl) return;

  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';

  const listEntity = world.query(TodoListContainer)[0];
  if (listEntity == null) return;
  world.createEntity(listEntity, [TodoText({ value: text }), Status({ completed: false })]);
}

// ── Build the static UI shell ───────────────────────────
const ui = (
  <Entity>
    <DOMElement tag="section" />
    <Classes list={['live-card']} />

    <Entity>
      <DOMElement tag="h3" />
      <TextContent value="Todo List" />
    </Entity>

    <Entity>
      <DOMElement tag="div" />
      <Style display="flex" gap="8px" marginBottom="12px" />

      <Entity>
        <DOMElement tag="input" />
        <TodoInput />
        <Style flex="1" padding="6px 10px" border="1px solid #d1d5db"
               borderRadius="4px" font="inherit" />
      </Entity>

      <Entity>
        <DOMElement tag="button" />
        <TextContent value="Add" />
        <Clickable onClick={(world) => addTodoFromInput(world)} />
      </Entity>
    </Entity>

    <Entity>
      <DOMElement tag="div" />
      <TodoListContainer />
    </Entity>
  </Entity>
);

materialize(world, ui);

// ── Seed initial todos ──────────────────────────────────
// Each todo is an entity with TodoText and Status, parented under the list container.
const listEntity = world.query(TodoListContainer)[0];

world.createEntity(listEntity, [TodoText({ value: 'Learn about ECS entities' }), Status({ completed: true })]);
world.createEntity(listEntity, [TodoText({ value: 'Build a todo app' }), Status({ completed: false })]);
world.createEntity(listEntity, [TodoText({ value: 'Try the live editor' }), Status({ completed: false })]);

world.flush();

// Let Enter key add todos too
const inputEntity = world.query(TodoInput)[0];
if (inputEntity != null) {
  getDOMElement(world, inputEntity)?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') {
      addTodoFromInput(world);
      world.flush();
    }
  });
}
`;

export const LIVE_EXAMPLES: Record<string, LiveExample> = {
  'manual-button': {
    title: 'Live Example',
    codeByMode: {
      jsx: MANUAL_JSX,
      nonjsx: MANUAL_NONJSX,
    },
  },
  'todo-app': {
    title: 'Todo List',
    codeByMode: {
      jsx: TODO_JSX,
      nonjsx: TODO_NONJSX,
    },
  },
};
