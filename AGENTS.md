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

Use the minimap script as the first lookup tool when you need to orient in an unfamiliar area, find the files responsible for a topic, or map a concept across packages/docs before opening files.

Minimap is most useful when:
- you are starting work in an area you do not know yet
- you need the most relevant files for a feature, subsystem, or concept
- you want authored docs and source files to surface together
- you want to narrow the search space before using `rg` for exact symbols or strings

Prefer minimap search over broad grepping for exploratory lookup. Prefer `rg` once you already know the likely files, or when you need exact text, identifier, or call-site matches.

## Commands

```bash
bun install
bun run dev
bun run typecheck
bun run check:full
bun run docs:build
bun run docs:dev
node --experimental-strip-types scripts/minimap.ts index
node --experimental-strip-types scripts/minimap.ts search "<query>"
node --experimental-strip-types scripts/minimap.ts validate
```

Minimap usage notes:
- `search` is the default entrypoint. It searches curated metadata first (`summary`, `tags`, exports, titles) and excludes tests unless you opt in.
- `search` automatically refreshes the SQLite index when indexed files are newer than `.minimap/minimap.sqlite`, so you usually do not need to run `index` manually.
- Run `index` explicitly after large metadata edits, if you want to prebuild the index, or if you need to inspect/search without waiting for an on-demand refresh.
- Run `validate` before finishing work that adds new indexed files or changes a file's purpose enough that its minimap metadata should change.
- Use `--include-text` only when metadata-first search is not enough and you need fallback text search.
- Use `--include-kind` / `--exclude-kind` to focus the results when you know you want docs, systems, tests, etc.
- Use `--select` to expose extra fields such as `kind`, `title`, `excerpt`, or `score` when ranking/context matters.

Examples:

```bash
node --experimental-strip-types scripts/minimap.ts search "form validation"
node --experimental-strip-types scripts/minimap.ts search "dom events" --include-kind system,source
node --experimental-strip-types scripts/minimap.ts search "world flush" --include-text --select path,summary,excerpt
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

## Minimap Metadata (Required)

Agent-facing search metadata lives with the source:
- TypeScript / TSX files: top-of-file `// @minimap summary: ...` and `// @minimap tags: ...`
- Authored MDX pages: frontmatter `minimapSummary` and `minimapTags`

When creating a new file, add minimap metadata as part of the initial file creation.

When editing an existing file, update its minimap metadata if the file's responsibility, behavior, or purpose changed enough that the current summary/tags are no longer accurate.

Treat minimap metadata maintenance as part of the definition of done for file creation and file edits.
