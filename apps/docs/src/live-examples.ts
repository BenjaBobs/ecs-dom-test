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
// Done is a marker — its presence means "completed".
const TodoText = defineComponent<{ value: string }>('TodoText');
const Done = defineMarker('Done');
const TodoInput = defineMarker('TodoInput');
const TodoListContainer = defineMarker('TodoListContainer');

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

// ── Helper: build child entities for a todo row ─────────
// Each todo entity gets three children: toggle button, label, delete button.
// This is called once when the todo is created, and again when Done changes.
function buildTodoRow(world, todoEntity) {
  const text = world.get(todoEntity, TodoText)?.value ?? '';
  const done = world.has(todoEntity, Done);

  // Toggle checkbox button — onClick handler toggles the Done marker
  // on the parent todo entity directly, no extra system needed
  const toggle = world.createEntity(todoEntity, [
    DOMElement({ tag: 'button' }),
    TextContent({ value: done ? '\\u2611' : '\\u2610' }),
    Style({ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer', padding: '0' }),
    Clickable({ onClick: (world, entity) => {
      const todo = world.getParent(entity);
      if (todo == null) return;
      if (world.has(todo, Done)) {
        world.remove(todo, Done);
      } else {
        world.add(todo, Done());
      }
    }}),
  ]);

  // Label showing the todo text
  world.createEntity(todoEntity, [
    DOMElement({ tag: 'span' }),
    TextContent({ value: text }),
    Style({
      flex: '1',
      textDecoration: done ? 'line-through' : 'none',
      opacity: done ? '0.5' : '1',
    }),
  ]);

  // Delete button — removes the entire todo entity on click
  world.createEntity(todoEntity, [
    DOMElement({ tag: 'button' }),
    TextContent({ value: 'Remove' }),
    Style({ border: 'none', background: 'none', color: '#ef4444', fontSize: '18px', cursor: 'pointer', padding: '0 4px' }),
    Clickable({ onClick: (world, entity) => {
      const todo = world.getParent(entity);
      if (todo == null) return;
      world.removeEntity(todo);
    }}),
  ]);
}

// Helper: tear down a todo's children and rebuild them
function rebuildTodoRow(world, entity) {
  for (const child of world.getChildren(entity)) {
    world.removeEntity(child);  // Recursively removes children + their DOM nodes
  }
  buildTodoRow(world, entity);
}

// ── Systems ─────────────────────────────────────────────

// When a TodoText entity first appears, set up its row DOM and children.
const TodoEnterSystem = defineReactiveSystem({
  name: 'TodoEnterSystem',
  query: Entities.with([TodoText]),
  onEnter(world, entities) {
    for (const entity of entities) {
      // Turn the todo entity itself into a flex row
      world.add(entity, DOMElement({ tag: 'div' }));
      world.add(entity, Style({
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 0', borderBottom: '1px solid #e5e7eb',
      }));
      buildTodoRow(world, entity);
    }
  },
});

// When a todo gains Done, rebuild its children to show the completed style.
// We need two systems because reactive queries fire onEnter when an entity
// starts matching — by querying for Done directly, we catch the transition.
const TodoMarkedDoneSystem = defineReactiveSystem({
  name: 'TodoMarkedDoneSystem',
  query: Entities.with([TodoText, Done]),
  onEnter(world, entities) {
    for (const entity of entities) {
      rebuildTodoRow(world, entity);
    }
  },
});

// When a todo loses Done, rebuild to show the incomplete style.
// This mirrors TodoMarkedDoneSystem for the opposite direction.
const TodoUnmarkedDoneSystem = defineReactiveSystem({
  name: 'TodoUnmarkedDoneSystem',
  query: Entities.with([TodoText, DOMElement]).without([Done]),
  onEnter(world, entities) {
    for (const entity of entities) {
      rebuildTodoRow(world, entity);
    }
  },
});

world.registerSystem(TodoEnterSystem);
world.registerSystem(TodoMarkedDoneSystem);
world.registerSystem(TodoUnmarkedDoneSystem);

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
  world.createEntity(listEntity, [TodoText({ value: text })]);
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
// Each todo is just an entity with TodoText, parented under the list container.
// Adding Done() marks it as completed. The systems handle the rest.
world.createEntity(list, [TodoText({ value: 'Learn about ECS entities' }), Done()]);
world.createEntity(list, [TodoText({ value: 'Build a todo app' })]);
world.createEntity(list, [TodoText({ value: 'Try the live editor' })]);

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
// Done is a marker — its presence means "completed".
const TodoText = defineComponent<{ value: string }>('TodoText');
const Done = defineMarker('Done');
const TodoInput = defineMarker('TodoInput');
const TodoListContainer = defineMarker('TodoListContainer');

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

// ── Helper: build child entities for a todo row ─────────
// Each todo entity gets three children: toggle button, label, delete button.
// materialize() creates entities from JSX and parents them under todoEntity.
function buildTodoRow(world, todoEntity) {
  const text = world.get(todoEntity, TodoText)?.value ?? '';
  const done = world.has(todoEntity, Done);

  materialize(world, [
    // Toggle checkbox — onClick handler toggles Done on the parent entity
    // directly, no extra marker or system needed
    <Entity>
      <DOMElement tag="button" />
      <TextContent value={done ? '\\u2611' : '\\u2610'} />
      <Style border="none" background="none" fontSize="18px" cursor="pointer" padding="0" />
      <Clickable onClick={(world, entity) => {
        const todo = world.getParent(entity);
        if (todo == null) return;
        if (world.has(todo, Done)) {
          world.remove(todo, Done);
        } else {
          world.add(todo, Done());
        }
      }} />
    </Entity>,

    // Label showing the todo text
    <Entity>
      <DOMElement tag="span" />
      <TextContent value={text} />
      <Style flex="1"
             textDecoration={done ? 'line-through' : 'none'}
             opacity={done ? '0.5' : '1'} />
    </Entity>,

    // Delete button — removes the entire todo entity on click
    <Entity>
      <DOMElement tag="button" />
      <TextContent value="Remove" />
      <Style border="none" background="none" color="#ef4444"
             fontSize="18px" cursor="pointer" padding="0 4px" />
      <Clickable onClick={(world, entity) => {
        const todo = world.getParent(entity);
        if (todo == null) return;
        world.removeEntity(todo);
      }} />
    </Entity>,
  ], todoEntity);
}

// Helper: tear down a todo's children and rebuild them
function rebuildTodoRow(world, entity) {
  for (const child of world.getChildren(entity)) {
    world.removeEntity(child);  // Recursively removes children + their DOM nodes
  }
  buildTodoRow(world, entity);
}

// ── Systems ─────────────────────────────────────────────

// When a TodoText entity first appears, set up its row DOM and children.
const TodoEnterSystem = defineReactiveSystem({
  name: 'TodoEnterSystem',
  query: Entities.with([TodoText]),
  onEnter(world, entities) {
    for (const entity of entities) {
      // Turn the todo entity itself into a flex row
      world.add(entity, DOMElement({ tag: 'div' }));
      world.add(entity, Style({
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 0', borderBottom: '1px solid #e5e7eb',
      }));
      buildTodoRow(world, entity);
    }
  },
});

// When a todo gains Done, rebuild its children to show the completed style.
// We need two systems because reactive queries fire onEnter when an entity
// starts matching — by querying for Done directly, we catch the transition.
const TodoMarkedDoneSystem = defineReactiveSystem({
  name: 'TodoMarkedDoneSystem',
  query: Entities.with([TodoText, Done]),
  onEnter(world, entities) {
    for (const entity of entities) {
      rebuildTodoRow(world, entity);
    }
  },
});

// When a todo loses Done, rebuild to show the incomplete style.
// This mirrors TodoMarkedDoneSystem for the opposite direction.
const TodoUnmarkedDoneSystem = defineReactiveSystem({
  name: 'TodoUnmarkedDoneSystem',
  query: Entities.with([TodoText, DOMElement]).without([Done]),
  onEnter(world, entities) {
    for (const entity of entities) {
      rebuildTodoRow(world, entity);
    }
  },
});

world.registerSystem(TodoEnterSystem);
world.registerSystem(TodoMarkedDoneSystem);
world.registerSystem(TodoUnmarkedDoneSystem);

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
  world.createEntity(listEntity, [TodoText({ value: text })]);
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
// Each todo is just an entity with TodoText, parented under the list container.
// Adding Done() marks it as completed. The systems handle the rest.
const listEntity = world.query(TodoListContainer)[0];

world.createEntity(listEntity, [TodoText({ value: 'Learn about ECS entities' }), Done()]);
world.createEntity(listEntity, [TodoText({ value: 'Build a todo app' })]);
world.createEntity(listEntity, [TodoText({ value: 'Try the live editor' })]);

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
