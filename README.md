# ECS UI Framework

A research project exploring Entity Component System (ECS) architecture for building user interfaces. The hypothesis: applying data-oriented design principles from game development to UI could yield better composability than traditional component-based frameworks.

## Project Structure

This is a monorepo with the following packages:

```
packages/
  ecs/          # @ecs-test/ecs - Core ECS engine
  dom/          # @ecs-test/dom - DOM renderer
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

Systems declare triggers and only run when matching mutations occur:

```tsx
const MySystem = defineReactiveSystem({
  triggers: [added(Selected), removed(Selected)],
  filter: [Radio],  // Optional: entity must also have these
  execute(entities, world) {
    for (const entity of entities) {
      // React to changes
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

See [design-choices.md](./design-choices.md) for detailed architectural decisions.
