// @minimap summary: Resolves DOM binding descriptors against ECS owners, syncs DOM values to value-rooted component data, and keeps subscriptions/listeners cleaned up.
// @minimap tags: dom binding system dombinding mutation subscribe path arrays maybe value ecs
/**
 * DOM binding runtime systems.
 */

import {
  defineComponent,
  defineReactiveSystem,
  Entities,
  type EntityId,
  type MutationEvent,
  type World,
} from '@ecs-test/ecs';
import { getDOMElement } from '../../dom-element-systems.ts';
import {
  type BindingDescriptor,
  type BindingStep,
  DOMBinding,
  type DOMBindingConfig,
  type ValueComponent,
} from './components.ts';

type ResolvedBindingTarget<T = unknown> = {
  ownerEntity: EntityId;
  get(): T;
  set(value: T): void;
  subscribe(notify: () => void): () => void;
};

type DOMBindingRuntime = {
  eventHandler?: EventListener;
  eventName?: string;
  hasLastWrittenValue: boolean;
  lastWrittenValue?: unknown;
  timerId?: number;
  unsubscribe?: () => void;
};

const DOMBindingRuntimes = defineComponent<{ entries: Map<EntityId, DOMBindingRuntime> }>(
  'DOMBindingRuntimes',
);

function getBindingRuntimes(world: World): Map<EntityId, DOMBindingRuntime> {
  const runtimeId = world.getRuntimeEntity();
  let state = world.get(runtimeId, DOMBindingRuntimes);
  if (!state) {
    state = { entries: new Map() };
    world.set(runtimeId, DOMBindingRuntimes(state));
  }
  return state.entries as Map<EntityId, DOMBindingRuntime>;
}

type TimerHost = {
  setTimeout(handler: TimerHandler, timeout?: number): number;
  clearTimeout(id: number | undefined): void;
};

function getTimerHost(world: World): TimerHost {
  const win = world.getExternals().window as (Window & TimerHost) | undefined;
  if (!win) {
    throw new Error('DOMBindingSystem requires a window external for timer management.');
  }
  return win;
}

function cleanupBinding(world: World, entity: EntityId): void {
  const runtimes = getBindingRuntimes(world);
  const runtime = runtimes.get(entity);
  if (!runtime) return;

  const el = getDOMElement(world, entity);
  if (runtime.eventHandler && el) {
    if (runtime.eventName) {
      el.removeEventListener(runtime.eventName, runtime.eventHandler);
    }
  }

  if (runtime.unsubscribe) {
    runtime.unsubscribe();
  }

  if (runtime.timerId !== undefined) {
    const timers = getTimerHost(world);
    timers.clearTimeout(runtime.timerId);
  }

  runtimes.delete(entity);
}

function isSelfOrAncestor(world: World, ancestorMaybe: EntityId, entity: EntityId): boolean {
  let current: EntityId | undefined = entity;
  while (current !== undefined) {
    if (current === ancestorMaybe) {
      return true;
    }
    current = world.getParent(current);
  }
  return false;
}

function findOwner<T>(world: World, entity: EntityId, component: ValueComponent<T>): EntityId {
  let current: EntityId | undefined = entity;
  while (current !== undefined) {
    if (world.has(current, component)) {
      return current;
    }
    current = world.getParent(current);
  }

  throw new Error(
    `Could not resolve binding owner for ${component._tag}. Binding entity ${entity} has no matching owner in its ancestor chain.`,
  );
}

function describeBindingPath(descriptor: BindingDescriptor): string {
  const suffix = descriptor.steps
    .map((step: BindingStep) => {
      switch (step.kind) {
        case 'field':
          return `.${step.key}${step.optional ? '?' : ''}`;
        case 'index':
          return `[${step.index}]`;
        case 'by':
          return `.by(${JSON.stringify(step.key)}, ${JSON.stringify(step.value)})`;
      }

      return assertNever(step);
    })
    .join('');

  return `${descriptor.component._tag}.value${suffix}`;
}

function readAtPath(
  rootValue: unknown,
  steps: readonly BindingStep[],
  descriptor: BindingDescriptor,
): unknown {
  let current = rootValue;

  for (const step of steps) {
    switch (step.kind) {
      case 'field': {
        if (current === null || current === undefined || typeof current !== 'object') {
          throw new Error(
            `Binding path ${describeBindingPath(descriptor)} expected an object before field "${step.key}".`,
          );
        }

        const record = current as Record<string, unknown>;
        if (!(step.key in record)) {
          if (step.optional) {
            return undefined;
          }
          throw new Error(
            `Binding path ${describeBindingPath(descriptor)} is missing field "${step.key}".`,
          );
        }

        current = record[step.key];
        break;
      }

      case 'index': {
        if (!Array.isArray(current)) {
          throw new Error(
            `Binding path ${describeBindingPath(descriptor)} expected an array before index ${step.index}.`,
          );
        }
        if (step.index < 0 || step.index >= current.length) {
          throw new Error(
            `Binding path ${describeBindingPath(descriptor)} is missing array index ${step.index}.`,
          );
        }
        current = current[step.index];
        break;
      }

      case 'by': {
        if (!Array.isArray(current)) {
          throw new Error(
            `Binding path ${describeBindingPath(descriptor)} expected an array before keyed lookup "${step.key}".`,
          );
        }

        const match = current.find(item => {
          if (item === null || item === undefined || typeof item !== 'object') {
            return false;
          }
          return (item as Record<string, unknown>)[step.key] === step.value;
        });

        if (match === undefined) {
          throw new Error(
            `Binding path ${describeBindingPath(descriptor)} could not find an array item where "${step.key}" equals ${JSON.stringify(step.value)}.`,
          );
        }

        current = match;
        break;
      }
    }
  }

  return current;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled binding step: ${JSON.stringify(value)}`);
}

function writeAtPath(
  rootValue: unknown,
  steps: readonly BindingStep[],
  nextValue: unknown,
  descriptor: BindingDescriptor,
): void {
  if (steps.length === 0) {
    throw new Error(
      `Binding path ${describeBindingPath(descriptor)} cannot be written without a root container.`,
    );
  }

  let current = rootValue;
  for (let index = 0; index < steps.length - 1; index += 1) {
    const step = steps[index]!;

    switch (step.kind) {
      case 'field': {
        if (current === null || current === undefined || typeof current !== 'object') {
          throw new Error(
            `Binding path ${describeBindingPath(descriptor)} expected an object before field "${step.key}".`,
          );
        }

        const record = current as Record<string, unknown>;
        if (!(step.key in record)) {
          throw new Error(
            `Binding path ${describeBindingPath(descriptor)} is missing field "${step.key}" for write.`,
          );
        }

        current = record[step.key];
        break;
      }

      case 'index': {
        if (!Array.isArray(current)) {
          throw new Error(
            `Binding path ${describeBindingPath(descriptor)} expected an array before index ${step.index}.`,
          );
        }
        if (step.index < 0 || step.index >= current.length) {
          throw new Error(
            `Binding path ${describeBindingPath(descriptor)} is missing array index ${step.index} for write.`,
          );
        }
        current = current[step.index];
        break;
      }

      case 'by': {
        if (!Array.isArray(current)) {
          throw new Error(
            `Binding path ${describeBindingPath(descriptor)} expected an array before keyed lookup "${step.key}".`,
          );
        }

        const match = current.find(item => {
          if (item === null || item === undefined || typeof item !== 'object') {
            return false;
          }
          return (item as Record<string, unknown>)[step.key] === step.value;
        });

        if (match === undefined) {
          throw new Error(
            `Binding path ${describeBindingPath(descriptor)} could not find an array item where "${step.key}" equals ${JSON.stringify(step.value)} for write.`,
          );
        }

        current = match;
        break;
      }
    }
  }

  const leaf = steps[steps.length - 1]!;
  switch (leaf.kind) {
    case 'field': {
      if (current === null || current === undefined || typeof current !== 'object') {
        throw new Error(
          `Binding path ${describeBindingPath(descriptor)} expected an object before field "${leaf.key}".`,
        );
      }
      (current as Record<string, unknown>)[leaf.key] = nextValue;
      return;
    }

    case 'index': {
      if (!Array.isArray(current)) {
        throw new Error(
          `Binding path ${describeBindingPath(descriptor)} expected an array before index ${leaf.index}.`,
        );
      }
      if (leaf.index < 0 || leaf.index >= current.length) {
        throw new Error(
          `Binding path ${describeBindingPath(descriptor)} is missing array index ${leaf.index} for write.`,
        );
      }
      current[leaf.index] = nextValue;
      return;
    }

    case 'by': {
      if (!Array.isArray(current)) {
        throw new Error(
          `Binding path ${describeBindingPath(descriptor)} expected an array before keyed lookup "${leaf.key}".`,
        );
      }

      const matchIndex = current.findIndex(item => {
        if (item === null || item === undefined || typeof item !== 'object') {
          return false;
        }
        return (item as Record<string, unknown>)[leaf.key] === leaf.value;
      });

      if (matchIndex < 0) {
        throw new Error(
          `Binding path ${describeBindingPath(descriptor)} could not find an array item where "${leaf.key}" equals ${JSON.stringify(leaf.value)} for write.`,
        );
      }

      current[matchIndex] = nextValue;
    }
  }
}

function resolveBindingTarget(
  world: World,
  entity: EntityId,
  descriptor: BindingDescriptor,
): ResolvedBindingTarget<unknown> {
  const ownerEntity = findOwner(world, entity, descriptor.component);

  return {
    ownerEntity,
    get() {
      const component = world.get(ownerEntity, descriptor.component) as
        | { value: unknown }
        | undefined;
      if (!component) {
        throw new Error(
          `Binding owner ${ownerEntity} no longer has component ${descriptor.component._tag} for ${describeBindingPath(descriptor)}.`,
        );
      }

      return readAtPath(component.value, descriptor.steps, descriptor);
    },
    set(value) {
      world.mutate(ownerEntity, descriptor.component, component => {
        const bindable = component as { value: unknown };
        if (descriptor.steps.length === 0) {
          bindable.value = value;
          return;
        }
        writeAtPath(bindable.value, descriptor.steps, value, descriptor);
      });
    },
    subscribe(notify) {
      return world.onMutation(
        (event: MutationEvent) => {
          if (isSelfOrAncestor(world, event.entity, entity)) {
            notify();
          }
        },
        { components: [descriptor.component] },
      );
    },
  };
}

function syncDOMFromTarget(world: World, entity: EntityId): void {
  const runtime = getBindingRuntimes(world).get(entity);
  const config = world.get(entity, DOMBinding) as DOMBindingConfig<unknown> | undefined;
  const el = getDOMElement(world, entity);
  if (!runtime || !config || !el || !config.write) return;

  const descriptor = config.bind.describe();
  const resolved = resolveBindingTarget(world, entity, descriptor);
  const value = resolved.get();

  if (runtime.hasLastWrittenValue && Object.is(runtime.lastWrittenValue, value)) {
    return;
  }

  config.write(el, value);
  runtime.lastWrittenValue = value;
  runtime.hasLastWrittenValue = true;
}

function commitRead(world: World, entity: EntityId, runtime: DOMBindingRuntime): void {
  const config = world.get(entity, DOMBinding) as DOMBindingConfig<unknown> | undefined;
  const el = getDOMElement(world, entity);
  if (!config || !el || !config.read) return;

  const descriptor = config.bind.describe();
  const resolved = resolveBindingTarget(world, entity, descriptor);
  const nextValue = config.read(el);

  runtime.lastWrittenValue = nextValue;
  runtime.hasLastWrittenValue = true;
  resolved.set(nextValue);
}

function setupBinding(world: World, entity: EntityId): void {
  cleanupBinding(world, entity);

  const config = world.get(entity, DOMBinding) as DOMBindingConfig<unknown> | undefined;
  const el = getDOMElement(world, entity);
  if (!config || !el) return;

  if (config.readEvent && !config.read) {
    throw new Error(`DOMBinding on entity ${entity} declares readEvent but no read(el) function.`);
  }
  if (config.readOnBind && !config.read) {
    throw new Error(`DOMBinding on entity ${entity} declares readOnBind but no read(el) function.`);
  }

  const runtime: DOMBindingRuntime = {
    hasLastWrittenValue: false,
  };
  getBindingRuntimes(world).set(entity, runtime);

  const descriptor = config.bind.describe();
  const resolved = resolveBindingTarget(world, entity, descriptor);
  runtime.unsubscribe = resolved.subscribe(() => {
    if (!world.exists(entity)) {
      cleanupBinding(world, entity);
      return;
    }
    syncDOMFromTarget(world, entity);
  });

  if (config.read && config.readEvent) {
    const timers = getTimerHost(world);
    runtime.eventHandler = () => {
      if (config.debounceMs && config.debounceMs > 0) {
        if (runtime.timerId !== undefined) {
          timers.clearTimeout(runtime.timerId);
        }
        runtime.timerId = timers.setTimeout(() => {
          runtime.timerId = undefined;
          commitRead(world, entity, runtime);
        }, config.debounceMs);
        return;
      }

      commitRead(world, entity, runtime);
    };

    el.addEventListener(config.readEvent, runtime.eventHandler);
    runtime.eventName = config.readEvent;
  }

  if (config.readOnBind) {
    commitRead(world, entity, runtime);
  }

  if (config.writeOnBind !== false) {
    syncDOMFromTarget(world, entity);
  }
}

export const DOMBindingSystem = defineReactiveSystem({
  name: 'DOMBindingSystem',
  query: Entities.with([DOMBinding, 'DOMElement']),
  onEnter(world, entities) {
    for (const entity of entities) {
      setupBinding(world, entity);
    }
  },
  onUpdate(world, entities) {
    for (const entity of entities) {
      setupBinding(world, entity);
    }
  },
  onExit(world, entities) {
    for (const entity of entities) {
      cleanupBinding(world, entity);
    }
  },
});
