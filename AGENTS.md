# AGENTS.md

This file provides guidance for any coding agent working in this repository.

## Project Vision

Research project exploring an ECS (Entity Component System) inspired UI framework. The hypothesis: applying data-oriented design principles from game architecture to UI could yield better composability and performance than traditional component-based frameworks like React.

### Core Concepts

- **Entities**: UI nodes (created via `<Entity>` in JSX)
- **Components**: Data attached to entities (state, styles, event handlers, etc.)
- **Systems**: Reactive functions that trigger on component changes and apply behavior
- **Bundles**: Reusable groups of components with `except`/`only` filtering

### Design Goals

1. **Minimal dependencies** - Build from primitives where possible
2. **CPU cache efficiency** - Contiguous memory layouts for component data (future goal)
3. **JSX syntax** - Familiar HTML-like authoring experience
4. **Composition over inheritance** - Behavior emerges from component combinations

## Project Structure

```
packages/
  ecs/          # @ecs-test/ecs - core ECS engine
  dom/          # @ecs-test/dom - DOM renderer (core + feature folders)
  forms/        # @ecs-test/forms - type-safe form state
  forms-ui/     # @ecs-test/forms-ui - ECS bindings for forms
  ui/           # @ecs-test/ui - reusable UI components (planned)

apps/
  playground/   # Demo application
```

## Commands

```bash
bun install            # Install dependencies
bun run dev            # Run dev server
bun run typecheck      # Type check
bun run check:full     # Type check + lint + tests
```

## Key Patterns

### Component Definition
```ts
const Position = defineComponent<{ x: number; y: number }>("Position");
const Selected = defineMarker("Selected");  // No data, just a flag
```

### Bundle Definition
```ts
const RadioOption = defineBundle(({ value }: { value: string }) => [
  DOMElement({ tag: "label" }),
  Clickable(),
  Value({ of: value }),
]);
```

### Reactive System
```ts
const MySystem = defineReactiveSystem({
  triggers: [added(Selected), removed(Selected)],
  filter: [Radio._tag],  // Optional: entity must also have these
  execute(entities, world) {
    for (const entity of entities) {
      // React to changes
    }
  },
});
```

### JSX Usage
```tsx
<Entity>
  <RadioOption value="small" except={[Clickable._tag]} />
  <Disabled />
  <Entity>
    <RadioIndicator />
  </Entity>
</Entity>
```

## Important Rules

- **One DOMElement per entity** - Each entity with `DOMElement` renders as one DOM node
- **Bundles in separate entities** - If two bundles both add `DOMElement`, put them in separate `<Entity>` wrappers
- **add vs set** - Use `world.add()` for initial setup (throws on duplicate), `world.set()` for updates (upserts)
- **Async state** - Start async ops in systems, call `world.flush()` in callbacks after adding result components
