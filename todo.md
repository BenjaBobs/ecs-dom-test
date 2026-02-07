# TODO

## Recently Completed

- [x] **Testing Infrastructure**
  - Bun test configuration working
  - happy-dom integrated for DOM testing
  - `withTestWorld` utility in `@ecs-test/dom/testing`
  - Test coverage for: World core, systems, components, scheduler, forms, forms-ui, DOM

- [x] **Forms package** (`@ecs-test/forms`)
  - Form factory pattern (define once, create isolated instances)
  - Type-safe field accessors with full path inference
  - Array operations (append, remove, reorder) with stable keys
  - Validation and computed fields
  - Zero dependencies

- [x] **Forms UI package** (`@ecs-test/forms-ui`)
  - FormData, FormBinding, FormDisplay, FieldError components
  - TextInput, NumberInput markers
  - Assertions for missing FormData ancestor and invalid field paths

- [x] **Reactive Systems Rewrite (Core)**
  - Query builder (`Entities.with([...]).without([...])`) with canonicalized tags
  - `ReactiveSystemDef` now uses `query` + optional `onEnter/onUpdate/onExit`
  - World flush rewritten for group membership + enter/update/exit semantics
  - Profiling updated to track onEnter/onUpdate/onExit entity sets

---

## 0. Reactive Systems Rewrite (In Progress)

Goal: replace trigger-based reactive systems with group/matcher-based queries.

- [x] Query builder API with type-safe `has` / `without`
- [x] World membership tracking + enter/update/exit dispatch ordering
- [x] Update ECS debug tools to new API
- [ ] Migrate all systems in `@ecs-test/dom`
- [ ] Migrate systems in `@ecs-test/forms-ui`
- [ ] Migrate playground systems
- [ ] Update tests to new API
- [ ] Remove old trigger helpers and update docs/examples

## 1. Debugging & Inspection

The goal: make it easy to understand what's happening in the ECS world at any point in time, and quickly identify the source of bugs.

### 1.1 World State Inspection

Core API for examining world state. Should return plain, serializable objects suitable for logging or dev tools.

- [x] `world.getEntities()` - List all entity IDs
- [x] `world.inspect(entityId)` - Get entity snapshot:
  ```ts
  {
    id: EntityId,
    parent: EntityId | null,
    children: EntityId[],
    components: { [tag: string]: unknown }  // component data by tag
  }
  ```
- [x] `world.snapshot()` - Full world state dump:
  ```ts
  {
    entities: EntitySnapshot[],
    systems: SystemInfo[],      // if names provided
    stats: { entityCount, componentCount, systemCount }
  }
  ```

### 1.2 System Naming (Optional)

System names are optional but highly recommended for debugging. When provided, they appear in:
- Error stack traces
- Performance profiles
- World snapshots
- Mutation logs

```ts
// Option A: Named parameter
const MySystem = defineReactiveSystem({
  name: 'MySystem',  // optional
  query: Entities.with([Position]).without([Inactive]),
  onUpdate(...) { ... }
});

// Option B: Inferred from variable (if feasible)
```

- [x] Add optional `name` field to `ReactiveSystemDef`
- [x] Store name in `ReactiveSystem` class
- [x] `world.getSystems()` - List registered systems with names and queries
- [x] Include system name in error messages when available

### 1.3 Mutation Tracking (Opt-in)

Subscribe to mutations for debugging or building dev tools. Disabled by default for zero overhead.

- [x] `world.onMutation(callback, options?)` - Subscribe to mutations as they happen
  ```ts
  // Watch all mutations
  world.onMutation((mutation) => {
    console.log(`${mutation.type}: ${mutation.componentTag} on entity ${mutation.entity}`);
  });

  // Watch specific entity (+ optionally descendants)
  world.onMutation(
    (mutation) => console.log(mutation),
    { entity: entityId, includeDescendants: true }
  );

  // Watch specific component types
  world.onMutation(
    (mutation) => console.log(mutation),
    { components: [Position, Velocity] }
  );
  ```
- [x] Returns `unsubscribe()` function
- [x] Filter options: `{ entity?, includeDescendants?, components? }`
- [x] Include component data in mutation event (the before/after values)

### 1.4 Entity Debugging (`@ecs-test/ecs`)

A dedicated package for runtime debugging tools. Allows targeted debugging of specific entities without overwhelming output.

#### Debug Marker & System

- [x] `Debug` marker component - Add to any entity to start tracking
- [x] `DebugSystem` - Automatically logs mutations when Debug is added
- [x] `DebugChildren` marker - Also track all descendant entities
- [x] Configurable output: console, callback, or buffer for later inspection

```ts
import { Debug, DebugChildren, registerDebugSystems, World } from '@ecs-test/ecs';

const world = new World({ externals: { console } });
registerDebugSystems(world);

// Debug a specific entity
world.add(entity, Debug());

// Debug entity and all its children
world.add(entity, Debug());
world.add(entity, DebugChildren());

// Or combine in one call
world.add(entity, Debug({ includeChildren: true, label: 'MyForm' }));
```

#### Debug Console/Inspector

- [x] `world.debug(entityId)` - Print entity state to console (one-shot)
- [x] `world.debugTree(entityId)` - Print entity + descendants as tree
- [x] Interactive debug UI window (tree view, selection details, draggable + resizable, opacity 0.75)
- [x] Entity tree folding + search with match highlighting
- [x] Debug UI hotkey toggle (`Ctrl+Shift+D`)
- [x] Debug UI system timing view with selectable bar timeline, pause, aggregation, and ISO timestamps
- [x] Exclude Debug UI self-cost from profiling (default on)

```ts
// Quick inspection
world.debug(entity);
// Output:
// Entity 42 (parent: 10)
//   DOMElement { tag: 'div' }
//   Classes { list: ['active', 'selected'] }
//   Children: [43, 44, 45]

world.debugTree(entity);
// Output:
// Entity 42 (DOMElement, Classes)
//   ├─ Entity 43 (DOMElement, TextContent)
//   ├─ Entity 44 (DOMElement, Clickable)
//   └─ Entity 45 (DOMElement)
//        └─ Entity 46 (DOMElement, TextContent)
```

### 1.5 Enhanced Error Messages

Errors should include enough context to identify the problem without additional debugging.

- [x] Include entity ID and existing components when add/set/remove fails
- [x] Include system name (if available) when error occurs during system execution
- [x] Include parent chain when hierarchy operations fail
- [x] Wrap system execute in try/catch to add context before re-throwing:
  ```
  Error in system "TextInputBindingSystem" while processing entity 42:
    Entity has: [DOMElement, TextInput, FormBinding]
    Parent chain: 42 → 10 → 1 (root)
    Original error: Cannot read property 'value' of undefined
  ```

---

## 2. Performance Profiling (Opt-in)

Track where time is spent during flush cycles. Must be zero-cost when disabled.

### 2.1 Per-Flush Metrics

- [x] `world.enableProfiling()` / `world.disableProfiling()`
- [x] `world.getLastFlushProfile()` - Get timing for most recent flush:
  ```ts
  {
    totalDuration: number,        // ms
    mutationCount: number,
    systemExecutions: [
      { name: string, duration: number, entityCount: number },
      ...
    ]
  }
  ```

### 2.2 Aggregate Metrics

- [x] `world.getProfilingStats()` - Aggregate stats since profiling enabled:
  ```ts
  {
    flushCount: number,
    totalDuration: number,
    avgFlushDuration: number,
    systemStats: Map<string, {
      callCount: number,
      totalDuration: number,
      avgDuration: number,
      maxDuration: number
    }>
  }
  ```
- [x] `world.resetProfilingStats()` - Clear accumulated stats

### 2.3 Implementation Notes

- Use `performance.now()` for timing (available in browser and Bun)
- Store profiling state in world instance, not global
- Consider: callback hook for custom profiling integration

---

## 3. Future Considerations

### Developer Tools (Browser Extension)
- Visual entity tree inspector
- Component data viewer/editor
- System execution timeline
- Overlay mode: highlight entity boundaries in DOM
- Time-travel debugging (mutation replay)

### Testing Enhancements
- Snapshot testing for world state (`expect(world.snapshot()).toMatchSnapshot()`)
- `expectEntity(world, id).toHave(Component)` assertion helpers
- Property-based testing for system invariants
- Performance regression tests

### Error Recovery
- Graceful handling of system errors (don't break the whole flush)
- Error boundaries for system execution
- Retry/skip strategies for failed systems

---

## Immediate Next Steps

1. **Finish reactive systems rewrite** - migrate remaining systems/tests and remove old trigger helpers
2. **Interactive debug UI actions** - add/remove/modify components from the debug panel
3. **Developer tools** - entity tree inspector, component editor, system timeline
