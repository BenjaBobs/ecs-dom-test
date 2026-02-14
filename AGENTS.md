# AGENTS.md

This file gives implementation rules for coding agents in this repository.

## Documentation Source Of Truth

Project explanations should live in docs pages, not duplicated here.

Use these pages for context:
- Overview concepts: `apps/docs/content/overview/concepts.mdx`
- Overview design choices: `apps/docs/content/overview/design-choices.mdx`
- Overview architecture: `apps/docs/content/overview/architecture.mdx`
- Project roadmap: `apps/docs/content/repo/roadmap.mdx`
- Current execution board: `apps/docs/content/repo/working-set.mdx`
- Dogfooding findings: `apps/docs/content/repo/friction-log.mdx`

Guides are for task-oriented walkthroughs (for example `apps/docs/content/guides/getting-started.mdx`).

## Project Structure

```text
packages/
  ecs/        @ecs-test/ecs
  dom/        @ecs-test/dom
  forms/      @ecs-test/forms
  forms-ui/   @ecs-test/forms-ui
  ui/         @ecs-test/ui

apps/
  playground/
  docs/
```

## Commands

```bash
bun install
bun run dev
bun run typecheck
bun run check:full
bun run docs:build
bun run docs:dev
```

## Implementation Rules

- One `DOMElement` per entity.
- If two bundles both add `DOMElement`, place them in separate `<Entity>` wrappers.
- Use `world.add()` for initial setup (throws on duplicate).
- Use `world.set()` for updates (upsert behavior).
- Start async work in systems and call `world.flush()` in callbacks after mutations.

## Planning And Tracking (Required)

All agent work must be tracked in repository docs:
- Roadmap: `apps/docs/content/repo/roadmap.mdx`
- Working set: `apps/docs/content/repo/working-set.mdx`
- Friction log: `apps/docs/content/repo/friction-log.mdx`

Before substantial implementation:
- Ensure the task exists in `working-set.mdx` (or add it).

After substantial implementation:
- Update `working-set.mdx` task status and `Recently Completed`.
- Record relevant findings in `friction-log.mdx`.
- Reflect priority/milestone shifts in `roadmap.mdx` when needed.

## Documentation Sync (Required)

Any change to code, architecture, behavior, APIs, workflows, or project structure must include updates to all relevant docs content so documentation remains current.

At minimum, agents must update applicable files under:
- `apps/docs/content/overview/`
- `apps/docs/content/guides/`
- `apps/docs/content/repo/`
- `apps/docs/content/api/` (when API generation or API-facing behavior changes)

Do not defer docs updates for \"later\" when shipping implementation changes.
