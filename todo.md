# TODO

## 1. Testing Infrastructure

### 1.1 Test Setup
- [ ] Add bun test configuration
- [ ] Add happy-dom as dev dependency
- [ ] Create test utilities module (`framework/test-utils.ts`)

### 1.2 Test Utilities
- [ ] `createTestWorld()` - World with optional DOM systems
- [ ] `createTestDOM()` - happy-dom document for integration tests
- [ ] Entity builder helpers for common test patterns
- [ ] Assertion helpers: `expectEntity(world, id).toHave(Component)`

### 1.3 Test Coverage
- [ ] World core (createEntity, add, set, remove, query)
- [ ] Reactive system triggers (added, removed, replaced, addedOrReplaced)
- [ ] Materialization (JSX → entities)
- [ ] DOM systems (integration with happy-dom)
- [ ] Example feature tests (radio, cat fetcher)

## 2. World Inspection API

### 2.1 Entity Inspection
- [ ] `world.getEntities()` - List all entity IDs
- [ ] `world.inspect(entityId)` - Get entity details (components, parent, children)
- [ ] `world.inspectAll()` - Full world state dump

### 2.2 System Inspection
- [ ] `world.getSystems()` - List registered systems with their triggers
- [ ] Track system names (add `name` to ReactiveSystem)

### 2.3 Mutation Tracking (opt-in)
- [ ] `world.onMutation(callback)` - Subscribe to mutations
- [ ] `world.getMutationLog()` - Get recent mutations (when enabled)
- [ ] Useful for debugging and testing assertions

## 3. Performance Monitoring (opt-in)

- [ ] `world.enableProfiling()` - Start collecting metrics
- [ ] `world.getMetrics()` - Flush count, avg duration, mutations/flush, system timings
- [ ] Keep it zero-cost when disabled

## 4. Future Considerations

### Developer Tools
- Browser extension for visual entity/component inspection
- Overlay mode: highlight entity boundaries in DOM
- System execution visualizer

### Advanced Testing
- Snapshot testing for world state
- Property-based testing for system invariants
- Performance regression tests

---

## Immediate Next Steps

1. **Testing setup** - Get bun test + happy-dom working
2. **World inspection** - Add `getEntities()`, `inspect()`, `inspectAll()`
3. **First tests** - World core + one integration test

