# ECS UI Framework

A research project exploring Entity Component System (ECS) architecture for building user interfaces. The hypothesis: applying data-oriented design principles from game development to UI could yield better composability than traditional component-based frameworks.

## Project Structure

This is a monorepo with the following packages:

```
packages/
  ecs/          # @ecs-test/ecs - Core ECS engine
  dom/          # @ecs-test/dom - DOM renderer
  forms/        # @ecs-test/forms - Type-safe form state (zero dependencies)
  forms-ui/     # @ecs-test/forms-ui - ECS bindings for forms
  ui/           # @ecs-test/ui - Reusable UI components (planned)

apps/
  playground/   # Demo application
```

### @ecs-test/ecs

Pure ECS primitives with no DOM dependency:
- **World** - Container for entities and components
- **Entities** - Unique identifiers for UI nodes
- **Components** - Data attached to entities (`defineComponent`, `defineMarker`)
- **Systems** - Reactive functions triggered by component mutations
- **Bundles** - Reusable groups of components with `except`/`only` filtering
- **JSX Runtime** - Custom JSX that produces entity trees
- **Materialization** - Converts JSX trees into ECS entities

### @ecs-test/forms

Pure TypeScript form state management (zero dependencies):
- **Form factories** - Define form schema once, create isolated instances
- **Type-safe accessors** - `f.name`, `f.books.at(0).title` with full autocomplete
- **Validation** - Per-field and computed validation with error messages
- **Computed fields** - Derived values that auto-update
- **Array operations** - append, remove, reorder with stable keys

```ts
const AuthorForm = createFormFactory<Author>({
  initialValues: { name: "", age: 0, books: [] },
  validate: { name: (v) => !v ? "Required" : undefined },
  computed: {
    averageScore: (d) => d.books.reduce((s, b) => s + b.score, 0) / d.books.length
  }
});

// Fully testable - no DOM, no ECS
const form = AuthorForm.create();
form.fields.name.set("Alice");
form.fields.books.append({ title: "Book 1", score: 5 });
```

### @ecs-test/forms-ui

ECS/DOM bindings for forms - connects `@ecs-test/forms` to the UI.

### @ecs-test/dom

DOM-specific components and systems:
- `DOMElement`, `TextContent`, `Classes` - Rendering components
- `Clickable`, `Clicked`, `Disabled` - Interaction components
- Reactive systems that sync ECS state to the DOM

## Getting Started

```bash
# Install dependencies
bun install

# Run type checking
bun run typecheck

# Run the playground
bun run dev
```

## Core Concepts

### Reactive Systems

Systems declare queries and react when entities enter/exit or update within that query:

```tsx
const MySystem = defineReactiveSystem({
  query: Entities.with([Radio, Selected]),
  onEnter(world, entities) {
    for (const entity of entities) {
      // React to entering the query
    }
  },
  onExit(world, entities) {
    for (const entity of entities) {
      // React to exiting the query
    }
  },
});
```

### Bundles

Reusable component groups with filtering:

```tsx
const RadioOption = defineBundle(({ value }: { value: string }) => [
  DOMElement({ tag: "label" }),
  Clickable(),
  Value({ of: value }),
]);

// Usage with filtering:
<RadioOption value="disabled" except={[Clickable]} />
```

### JSX Usage

```tsx
<Entity>
  <RadioGroup name="Size" />
  <Entity>
    <RadioOption value="small" />
    <Entity><RadioIndicator /></Entity>
    <Entity><TextSpan content="Small" /></Entity>
  </Entity>
</Entity>
```

## Design Principles

- **Event-driven, not frame-based** - Systems only run when mutations occur
- **Composition over inheritance** - Behavior emerges from component combinations
- **World isolation** - Multiple worlds can coexist independently
- **Renderer-agnostic core** - ECS primitives don't depend on DOM

## Testing Notes

When writing DOM tests (especially with `happy-dom`), avoid assertions that pass
large DOM objects directly into `expect(...)`. If such an assertion fails, Bun
may stringify the entire DOM tree (and `window` graph), producing extremely large
stdout output. Prefer targeted checks (e.g., specific node text or counts) or
helpers that limit the inspected text length.

See [design-choices.md](./design-choices.md) for detailed architectural decisions.
