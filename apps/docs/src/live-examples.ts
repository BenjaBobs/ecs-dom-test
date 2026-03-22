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
  Clicked,
  registerDOMSystems,
  getDOMElement,
} from '/playground/modules/dom.js';

// ── Components ──────────────────────────────────────────
// TodoText holds the text for a single todo item.
// Done is a marker — its presence means "completed".
// The rest are markers to tag key entities so systems can find them.
const TodoText = defineComponent<{ value: string }>('TodoText');
const Done = defineMarker('Done');
const TodoInput = defineMarker('TodoInput');
const AddButton = defineMarker('AddButton');
const TodoListContainer = defineMarker('TodoListContainer');
const ToggleButton = defineMarker('ToggleButton');
const DeleteButton = defineMarker('DeleteButton');

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

  // Toggle checkbox button
  const toggle = world.createEntity(todoEntity);
  world.add(toggle, DOMElement({ tag: 'button' }));
  world.add(toggle, TextContent({ value: done ? '\\u2611' : '\\u2610' }));
  world.add(toggle, Style({ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer', padding: '0' }));
  world.add(toggle, Clickable());   // Makes the entity emit Clicked on click
  world.add(toggle, ToggleButton()); // Tags it so ToggleTodoSystem can find it

  // Label showing the todo text
  const label = world.createEntity(todoEntity);
  world.add(label, DOMElement({ tag: 'span' }));
  world.add(label, TextContent({ value: text }));
  world.add(label, Style({
    flex: '1',
    textDecoration: done ? 'line-through' : 'none',
    opacity: done ? '0.5' : '1',
  }));

  // Delete button
  const del = world.createEntity(todoEntity);
  world.add(del, DOMElement({ tag: 'button' }));
  world.add(del, TextContent({ value: '\\u00d7' }));
  world.add(del, Style({ border: 'none', background: 'none', color: '#ef4444', fontSize: '18px', cursor: 'pointer', padding: '0 4px' }));
  world.add(del, Clickable());
  world.add(del, DeleteButton());
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

// When a toggle button is clicked, walk up to the parent todo and flip Done.
const ToggleTodoSystem = defineReactiveSystem({
  name: 'ToggleTodoSystem',
  query: Entities.with([Clicked, ToggleButton]),
  onEnter(world, entities) {
    for (const e of entities) {
      world.remove(e, Clicked);  // Consume the click event
      // The button is a child of the todo entity — walk up one level
      const todoEntity = world.getParent(e);
      if (todoEntity == null) continue;

      // Toggle is just adding or removing a marker component
      if (world.has(todoEntity, Done)) {
        world.remove(todoEntity, Done);
      } else {
        world.add(todoEntity, Done());
      }
    }
  },
});

// When a todo gains Done, rebuild its children to show the completed style.
// We need TWO systems because onUpdate only fires for query-component changes,
// not for any component change on a matched entity. By querying for Done
// directly, onEnter fires when Done is added to a TodoText entity.
const TodoMarkedDoneSystem = defineReactiveSystem({
  name: 'TodoMarkedDoneSystem',
  query: Entities.with([TodoText, Done]),
  onEnter(world, entities) {
    for (const entity of entities) {
      rebuildTodoRow(world, entity);
    }
  },
});

// When a todo loses Done, rebuild its children to show the incomplete style.
// This mirrors TodoMarkedDoneSystem: onEnter fires here when Done is removed,
// because the entity now enters the TodoText-without-Done query.
const TodoUnmarkedDoneSystem = defineReactiveSystem({
  name: 'TodoUnmarkedDoneSystem',
  query: Entities.with([TodoText, DOMElement]).without([Done]),
  onEnter(world, entities) {
    for (const entity of entities) {
      rebuildTodoRow(world, entity);
    }
  },
});

// When a delete button is clicked, remove the parent todo entity entirely.
// removeEntity recursively removes children, and DOMElementSystem's onExit
// cleans up the DOM nodes automatically.
const DeleteTodoSystem = defineReactiveSystem({
  name: 'DeleteTodoSystem',
  query: Entities.with([Clicked, DeleteButton]),
  onEnter(world, entities) {
    for (const e of entities) {
      world.remove(e, Clicked);
      const todoEntity = world.getParent(e);
      if (todoEntity == null) continue;
      world.removeEntity(todoEntity);
    }
  },
});

// When the Add button is clicked, read the input and create a new todo entity.
const AddTodoSystem = defineReactiveSystem({
  name: 'AddTodoSystem',
  query: Entities.with([Clicked, AddButton]),
  onEnter(world, entities) {
    for (const e of entities) world.remove(e, Clicked);

    // No built-in input component — use getDOMElement to access the raw DOM node
    const inputEntity = world.query(TodoInput)[0];
    if (inputEntity == null) return;
    const inputEl = getDOMElement(world, inputEntity) as HTMLInputElement | undefined;
    if (!inputEl) return;

    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';

    // Create the todo as a child of the list container.
    // TodoEnterSystem will pick it up and build its DOM children.
    const listEntity = world.query(TodoListContainer)[0];
    if (listEntity == null) return;
    const todo = world.createEntity(listEntity);
    world.add(todo, TodoText({ value: text }));
  },
});

world.registerSystem(TodoEnterSystem);
world.registerSystem(ToggleTodoSystem);
world.registerSystem(TodoMarkedDoneSystem);
world.registerSystem(TodoUnmarkedDoneSystem);
world.registerSystem(DeleteTodoSystem);
world.registerSystem(AddTodoSystem);

// ── Build the static UI shell ───────────────────────────
const card = world.createEntity();
world.add(card, DOMElement({ tag: 'section' }));
world.add(card, Classes({ list: ['live-card'] }));

const heading = world.createEntity(card);
world.add(heading, DOMElement({ tag: 'h3' }));
world.add(heading, TextContent({ value: 'Todo List' }));

const form = world.createEntity(card);
world.add(form, DOMElement({ tag: 'div' }));
world.add(form, Style({ display: 'flex', gap: '8px', marginBottom: '12px' }));

const input = world.createEntity(form);
world.add(input, DOMElement({ tag: 'input' }));
world.add(input, TodoInput());
world.add(input, Style({ flex: '1', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', font: 'inherit' }));

const addBtn = world.createEntity(form);
world.add(addBtn, DOMElement({ tag: 'button' }));
world.add(addBtn, TextContent({ value: 'Add' }));
world.add(addBtn, Clickable());
world.add(addBtn, AddButton());

const list = world.createEntity(card);
world.add(list, DOMElement({ tag: 'div' }));
world.add(list, TodoListContainer());

// ── Seed initial todos ──────────────────────────────────
// Each todo is just an entity with TodoText, parented under the list container.
// Adding Done() marks it as completed. The systems handle the rest.
const todo1 = world.createEntity(list);
world.add(todo1, TodoText({ value: 'Learn about ECS entities' }));
world.add(todo1, Done());

const todo2 = world.createEntity(list);
world.add(todo2, TodoText({ value: 'Build a todo app' }));

const todo3 = world.createEntity(list);
world.add(todo3, TodoText({ value: 'Try the live editor' }));

world.flush();

// Let Enter key add todos too
getDOMElement(world, input)?.addEventListener('keydown', (e) => {
  if ((e as KeyboardEvent).key === 'Enter') {
    world.set(addBtn, Clicked());
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
  Clicked,
  registerDOMSystems,
  getDOMElement,
} from '/playground/modules/dom.js';

// ── Components ──────────────────────────────────────────
// TodoText holds the text for a single todo item.
// Done is a marker — its presence means "completed".
// The rest are markers to tag key entities so systems can find them.
const TodoText = defineComponent<{ value: string }>('TodoText');
const Done = defineMarker('Done');
const TodoInput = defineMarker('TodoInput');
const AddButton = defineMarker('AddButton');
const TodoListContainer = defineMarker('TodoListContainer');
const ToggleButton = defineMarker('ToggleButton');
const DeleteButton = defineMarker('DeleteButton');

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
    // Toggle checkbox button — Clickable makes it emit Clicked on click,
    // ToggleButton tags it so ToggleTodoSystem can find it
    <Entity>
      <DOMElement tag="button" />
      <TextContent value={done ? '\\u2611' : '\\u2610'} />
      <Style border="none" background="none" fontSize="18px" cursor="pointer" padding="0" />
      <Clickable />
      <ToggleButton />
    </Entity>,

    // Label showing the todo text
    <Entity>
      <DOMElement tag="span" />
      <TextContent value={text} />
      <Style flex="1"
             textDecoration={done ? 'line-through' : 'none'}
             opacity={done ? '0.5' : '1'} />
    </Entity>,

    // Delete button
    <Entity>
      <DOMElement tag="button" />
      <TextContent value="\\u00d7" />
      <Style border="none" background="none" color="#ef4444"
             fontSize="18px" cursor="pointer" padding="0 4px" />
      <Clickable />
      <DeleteButton />
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

// When a toggle button is clicked, walk up to the parent todo and flip Done.
const ToggleTodoSystem = defineReactiveSystem({
  name: 'ToggleTodoSystem',
  query: Entities.with([Clicked, ToggleButton]),
  onEnter(world, entities) {
    for (const e of entities) {
      world.remove(e, Clicked);  // Consume the click event
      // The button is a child of the todo entity — walk up one level
      const todoEntity = world.getParent(e);
      if (todoEntity == null) continue;

      // Toggle is just adding or removing a marker component
      if (world.has(todoEntity, Done)) {
        world.remove(todoEntity, Done);
      } else {
        world.add(todoEntity, Done());
      }
    }
  },
});

// When a todo gains Done, rebuild its children to show the completed style.
// We need TWO systems because onUpdate only fires for query-component changes,
// not for any component change on a matched entity. By querying for Done
// directly, onEnter fires when Done is added to a TodoText entity.
const TodoMarkedDoneSystem = defineReactiveSystem({
  name: 'TodoMarkedDoneSystem',
  query: Entities.with([TodoText, Done]),
  onEnter(world, entities) {
    for (const entity of entities) {
      rebuildTodoRow(world, entity);
    }
  },
});

// When a todo loses Done, rebuild its children to show the incomplete style.
// This mirrors TodoMarkedDoneSystem: onEnter fires here when Done is removed,
// because the entity now enters the TodoText-without-Done query.
const TodoUnmarkedDoneSystem = defineReactiveSystem({
  name: 'TodoUnmarkedDoneSystem',
  query: Entities.with([TodoText, DOMElement]).without([Done]),
  onEnter(world, entities) {
    for (const entity of entities) {
      rebuildTodoRow(world, entity);
    }
  },
});

// When a delete button is clicked, remove the parent todo entity entirely.
// removeEntity recursively removes children, and DOMElementSystem's onExit
// cleans up the DOM nodes automatically.
const DeleteTodoSystem = defineReactiveSystem({
  name: 'DeleteTodoSystem',
  query: Entities.with([Clicked, DeleteButton]),
  onEnter(world, entities) {
    for (const e of entities) {
      world.remove(e, Clicked);
      const todoEntity = world.getParent(e);
      if (todoEntity == null) continue;
      world.removeEntity(todoEntity);
    }
  },
});

// When the Add button is clicked, read the input and create a new todo entity.
const AddTodoSystem = defineReactiveSystem({
  name: 'AddTodoSystem',
  query: Entities.with([Clicked, AddButton]),
  onEnter(world, entities) {
    for (const e of entities) world.remove(e, Clicked);

    // No built-in input component — use getDOMElement to access the raw DOM node
    const inputEntity = world.query(TodoInput)[0];
    if (inputEntity == null) return;
    const inputEl = getDOMElement(world, inputEntity) as HTMLInputElement | undefined;
    if (!inputEl) return;

    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';

    // Create the todo as a child of the list container.
    // TodoEnterSystem will pick it up and build its DOM children.
    const listEntity = world.query(TodoListContainer)[0];
    if (listEntity == null) return;
    const todo = world.createEntity(listEntity);
    world.add(todo, TodoText({ value: text }));
  },
});

world.registerSystem(TodoEnterSystem);
world.registerSystem(ToggleTodoSystem);
world.registerSystem(TodoMarkedDoneSystem);
world.registerSystem(TodoUnmarkedDoneSystem);
world.registerSystem(DeleteTodoSystem);
world.registerSystem(AddTodoSystem);

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
        <Clickable />
        <AddButton />
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

const t1 = world.createEntity(listEntity);
world.add(t1, TodoText({ value: 'Learn about ECS entities' }));
world.add(t1, Done());

const t2 = world.createEntity(listEntity);
world.add(t2, TodoText({ value: 'Build a todo app' }));

const t3 = world.createEntity(listEntity);
world.add(t3, TodoText({ value: 'Try the live editor' }));

world.flush();

// Let Enter key add todos too
const addBtn = world.query(AddButton)[0];
const inputEntity = world.query(TodoInput)[0];
if (inputEntity != null && addBtn != null) {
  getDOMElement(world, inputEntity)?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') {
      world.set(addBtn, Clicked());
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
