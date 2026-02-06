import { defineComponent, defineMarker } from './component.ts';
import { added, addedOrReplaced, defineReactiveSystem, removed } from './system.ts';
import type { EntityId, MutationEvent, World } from './world.ts';

export type DebugLogEntry = {
  timestamp: number;
  entity: EntityId;
  rootEntity: EntityId;
  label?: string;
  mutation: MutationEvent;
};

export type DebugBuffer = {
  entries: DebugLogEntry[];
  maxEntries?: number;
};

export type DebugOutput =
  | { type: 'console' }
  | { type: 'callback'; callback: (entry: DebugLogEntry) => void }
  | { type: 'buffer'; buffer: DebugBuffer };

export type DebugOptions = {
  includeChildren?: boolean;
  label?: string;
  output?: DebugOutput;
};

export const Debug = defineComponent<DebugOptions | undefined>('Debug');

export const DebugChildren = defineMarker('DebugChildren');

export type DebugSystemOptions = {
  output?: DebugOutput;
};

export type DebugSystemHandle = {
  enable: () => void;
  disable: () => void;
  dispose: () => void;
  getTrackedEntities: () => EntityId[];
};

type DebugConfig = {
  includeChildren: boolean;
  label?: string;
  output: DebugOutput;
};

type DebugState = {
  enabled: boolean;
  tracked: Map<EntityId, DebugConfig>;
  unsubscribe: (() => void) | null;
};

type DebugLogger = { log: (...args: unknown[]) => void } | undefined;

function resolveDebugConfig(
  world: World,
  entity: EntityId,
  defaultOutput: DebugOutput,
): DebugConfig | null {
  if (!world.has(entity, Debug)) return null;

  const data = (world.get(entity, Debug) ?? {}) as DebugOptions;
  const includeChildren = Boolean(data.includeChildren || world.has(entity, DebugChildren));
  const output = data.output ?? defaultOutput;

  return {
    includeChildren,
    label: data.label,
    output,
  };
}

function findDebugRoot(
  world: World,
  state: DebugState,
  entity: EntityId,
): { root: EntityId; config: DebugConfig } | null {
  const direct = state.tracked.get(entity);
  if (direct) {
    return { root: entity, config: direct };
  }

  let current = world.getParent(entity);
  while (current !== undefined) {
    const config = state.tracked.get(current);
    if (config?.includeChildren) {
      return { root: current, config };
    }
    current = world.getParent(current);
  }

  return null;
}

function emitDebugEntry(entry: DebugLogEntry, output: DebugOutput, logger: DebugLogger): void {
  switch (output.type) {
    case 'console': {
      const labelSuffix = entry.label ? ` (${entry.label})` : '';
      const rootSuffix = entry.rootEntity === entry.entity ? '' : ` root=${entry.rootEntity}`;
      const message =
        `[Debug${labelSuffix}] ${entry.mutation.type} ${entry.mutation.componentTag} ` +
        `entity=${entry.entity}${rootSuffix}`;
      logger?.log?.(message, entry.mutation);
      return;
    }
    case 'callback':
      output.callback(entry);
      return;
    case 'buffer': {
      output.buffer.entries.push(entry);
      if (output.buffer.maxEntries && output.buffer.entries.length > output.buffer.maxEntries) {
        output.buffer.entries.splice(0, output.buffer.entries.length - output.buffer.maxEntries);
      }
      return;
    }
  }
}

export function registerDebugSystems(
  world: World,
  options: DebugSystemOptions = {},
): DebugSystemHandle {
  const defaultOutput: DebugOutput = options.output ?? { type: 'console' };
  const state: DebugState = {
    enabled: true,
    tracked: new Map(),
    unsubscribe: null,
  };

  const syncEntity = (entity: EntityId): void => {
    const config = resolveDebugConfig(world, entity, defaultOutput);
    if (config) {
      state.tracked.set(entity, config);
    } else {
      state.tracked.delete(entity);
    }
  };

  world.registerSystem(
    defineReactiveSystem({
      name: 'DebugTrackingSystem',
      triggers: [
        addedOrReplaced(Debug),
        removed(Debug),
        added(DebugChildren),
        removed(DebugChildren),
      ],
      execute(entities) {
        if (!state.enabled) return;
        for (const entity of entities) {
          syncEntity(entity);
        }
      },
    }),
  );

  state.unsubscribe = world.onMutation((event: MutationEvent) => {
    if (!state.enabled) return;
    const match = findDebugRoot(world, state, event.entity);
    if (!match) return;

    const entry: DebugLogEntry = {
      timestamp: Date.now(),
      entity: event.entity,
      rootEntity: match.root,
      label: match.config.label,
      mutation: event,
    };

    emitDebugEntry(entry, match.config.output, world.getExternals().console);
  });

  return {
    enable() {
      state.enabled = true;
    },
    disable() {
      state.enabled = false;
    },
    dispose() {
      state.enabled = false;
      state.tracked.clear();
      state.unsubscribe?.();
      state.unsubscribe = null;
    },
    getTrackedEntities() {
      return Array.from(state.tracked.keys());
    },
  };
}
