# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
framework/              # The ECS UI framework
  ecs/index.ts         # World, entities, components, systems, bundles
  dom/index.ts         # DOM components (DOMElement, Clickable, etc.) and systems
  jsx-runtime.ts       # JSX runtime (Entity, Fragment)
  materialize.ts       # JSX -> ECS entity tree
  index.ts             # Main barrel export

src/                   # Consumer/app code (feature-based)
  radio/index.ts       # Radio group feature (components, systems, bundles)
  cat/index.ts         # Cat fetcher feature (async demo)
  main.tsx             # App entry point

index.html             # HTML entry
```

## Commands

```bash
bun install            # Install dependencies
bun run index.html     # Run dev server
bun run tsc --noEmit   # Type check
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
