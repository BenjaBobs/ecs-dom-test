# Design Choices

Architectural decisions for this ECS UI framework, including what we chose NOT to do and why.

## Context: UI vs Game ECS

This framework targets browser UI, not games. This context shapes every decision:

| Aspect           | Game ECS                       | UI ECS                          |
| ---------------- | ------------------------------ | ------------------------------- |
| Execution        | 60+ FPS game loop              | Event-driven                    |
| Entity count     | Thousands                      | Hundreds                        |
| Read:write ratio | Read-heavy (query every frame) | Balanced (query only on events) |
| Component churn  | Low (stable archetypes)        | High (dynamic state changes)    |
| Between events   | Systems still run              | Nothing happens                 |

## What We Do

### Reactive Systems (Entitas-style)
Systems declare triggers (`added`, `removed`, `replaced`) and only run when matching mutations occur.

**Why:** Event-driven UI means no wasted work between interactions. Systems sleep until relevant changes happen.

### Component Index
`Map<componentTag, Set<EntityId>>` maintained on add/set/remove.

**Why:** O(1) lookup for "all entities with component X" without full archetype machinery. Good balance for UI's read:write ratio.

### Two-Pass Materialization
When materializing JSX, components/bundles are processed before child entities.

**Why:** Ensures parent's `DOMElement` exists before children try to attach to it. Deterministic DOM tree construction.

### Separate Reactive Systems for Behavior
`ClickableAddSystem`, `DisabledAddSystem`, etc. are separate from `DOMCreateSystem`.

**Why:** Adding `Clickable` to an existing entity should work. Creation-time-only wiring is a bug, not a feature.

### `Classes` as Single Source of Truth
Removed `class` from `DOMElement`. All CSS classes go through `Classes` component.

**Why:** Two systems writing to `el.className` will fight. One source of truth eliminates the conflict.

### Value-Centric Data Binding
Data flows through a single `Value` component on an entity. External systems (DOM, forms, etc.) bind to `Value` rather than to each other.

**Why:**
- Avoids tight coupling between DOM input state and form state
- Enables non-DOM entities to participate in data flows (e.g., pure data entities, future renderers)
- Supports multi-step transformations across boundaries (DOM ↔ Value ↔ Form) without mixing concerns

**Implementation direction:**
- `DOMElement` stays a renderer primitive (no binding logic)
- DOM bindings live in separate components/systems (e.g., `DOMBinding`, `DOMTrigger`)
- Form bindings translate between form fields and `Value`, optionally with transforms when types differ
- Bundles can hide extra components for ergonomics while keeping the model explicit

**Example (conceptual):**
```tsx
<Entity>
  <DOMElement tag="input" />
  <Value value={0} />
  <DOMBinding
    trigger="input"
    toValue={(el) => parseFloat((el as HTMLInputElement).value)}
    fromValue={(v) => String(v)}
  />
  <FormBinding
    field={f.age}
    toValue={(formValue) => formValue}
    fromValue={(value) => value}
  />
</Entity>
```

### Feature-First Structure (Including Styles)
Features should own their components, systems, and styles together (folder per feature). Styles are applied via `Classes` and are kept in feature-scoped CSS files imported by that feature's entry module.

**Why:**
- ECS behavior and styling evolve together; co-locating avoids cross-folder churn
- Encourages reusable feature modules that can be moved into packages later
- Bundles can provide default `Classes` while `except={[Classes]}` lets consumers override
- 
### World Isolation
Each `World` instance is fully independent. Multiple worlds can coexist in the same DOM (e.g., two app roots).

**Why:** Enables micro-frontends, isolated widgets, testing without cleanup.

**Implementation:** DOM element storage uses `WeakMap<World, Map<EntityId, Element>>`. When a world is garbage collected, its DOM mappings are automatically cleaned up.

## What We Don't Do (and Why)

### No Archetypes / Chunk Storage
Archetypes group entities with identical component sets into contiguous memory tables.

**Why not:**
- Optimizes for iteration-heavy workloads (query every frame)
- We're event-driven - systems only run on mutations
- Component churn in UI (adding/removing state) would cause frequent archetype moves
- Added complexity not justified for our access patterns

### No Cached Query Groups (Entitas Groups/Collectors)
Groups maintain a live `Set<EntityId>` for a query, updated on every mutation.

**Why not:**
- Trades write speed for read speed
- Makes sense when queries run 60x/second
- We query only when events occur - caching overhead not justified
- The component index gives us 80% of the benefit with 20% of the complexity

### No Frame-Based Scheduling
No `requestAnimationFrame` loop running systems continuously.

**Why not:**
- UI is event-driven, not frame-driven
- Running systems when nothing changed wastes CPU and battery
- Reactive triggers naturally batch related changes within a single flush

### No Structural Sharing / Immutable Components
Components are mutable. No copy-on-write or persistent data structures.

**Why not:**
- Added complexity for time-travel debugging we don't need yet
- Mutable is simpler and faster for our scale
- Can revisit if debugging tools demand it

### No Built-in Async Scheduling
Async operations (fetch) are started in systems, with callbacks adding components and calling `flush()`.

**Why not build in async primitives:**
- Keeps the core synchronous and predictable
- Async is handled at the edges (systems that start fetches)
- `flush()` in callbacks is explicit - no magic

## Pending Decisions

### DOM Write Batching
**Status:** Not implemented yet

**Problem:** Multiple systems modifying DOM in one flush could cause layout thrashing.

**Options:**
1. Batch all DOM writes to end of flush (collect mutations, apply once)
2. Use `requestAnimationFrame` to defer DOM writes
3. Trust browser's natural batching within a single synchronous block

**Leaning toward:** Option 3 initially. Browsers batch synchronous DOM writes before paint. Only add complexity if we measure thrashing.

### Microtask Flush in Event Handlers
**Status:** Deferred

**Problem:** `world.flush()` in click handlers is re-entrant.

**Current:** Works fine for simple cases. Monitor for ordering bugs before adding complexity.

### Relationships Beyond Parent-Child
**Status:** Not implemented

**Potential:** First-class entity links like `(FocusTarget, entityId)`, `(FormOwner, entityId)`.

**Why interesting:** Queryable relationships could simplify focus management, form handling, tooltips.
