/**
 * Main entry point - ECS UI Demo
 */

import {
  Classes,
  Clickable,
  createDebugUI,
  Disabled,
  DOMElement,
  registerDebugUISystems,
  registerDOMSystems,
  TextContent,
} from '@ecs-test/dom';
import { Entity, materialize, World } from '@ecs-test/ecs';
import { registerFormSystems } from '@ecs-test/forms-ui';
import { AuthorFormUI, registerAuthorSystems } from './author/index.ts';

import { CatDisplay, FetchCatBtn, type FetchFn, registerCatSystems } from './cat/index.ts';
import {
  RadioGroup,
  RadioIndicator,
  RadioOption,
  registerRadioSystems,
  TextSpan,
} from './radio/index.ts';

type PlaygroundDeps = {
  doc: Document;
  fetchFn: FetchFn;
};

export function startPlayground({ doc, fetchFn }: PlaygroundDeps): void {
  const container = doc.getElementById('root');
  if (!container) {
    console.error('Failed to mount - missing #root container');
    return;
  }

  // Create the world
  const view = doc.defaultView;
  if (!view) {
    console.error('Failed to mount - missing window');
    return;
  }

  const world = new World({
    externals: {
      createElement: doc.createElement.bind(doc),
      rootContainer: container,
      window: view,
      console,
    },
  });

  // Register systems (order matters!)
  registerDOMSystems(world);
  registerDebugUISystems(world);
  registerFormSystems(world);
  registerRadioSystems(world);
  registerCatSystems(world, { fetchFn });
  registerAuthorSystems(world);

  // Define the UI using JSX
  const ui = (
    <Entity>
      <DOMElement tag="div" />
      <Classes list={['app']} />

      {/* Author Form Demo */}
      <Entity>
        <DOMElement tag="section" />
        <Classes list={['demo-section']} />

        <Entity>
          <DOMElement tag="h1" />
          <TextContent value="Author Form Demo" />
        </Entity>

        <AuthorFormUI />
      </Entity>

      {/* Radio Group Demo */}
      <Entity>
        <DOMElement tag="section" />
        <Classes list={['demo-section']} />

        <Entity>
          <DOMElement tag="h1" />
          <TextContent value="Radio Group Demo" />
        </Entity>

        <Entity>
          <RadioGroup name="Size" />

          <Entity>
            <RadioOption value="small" />
            <Entity>
              <RadioIndicator />
            </Entity>
            <Entity>
              <TextSpan content="Small" />
            </Entity>
          </Entity>

          <Entity>
            <RadioOption value="medium" />
            <Entity>
              <RadioIndicator />
            </Entity>
            <Entity>
              <TextSpan content="Medium" />
            </Entity>
          </Entity>

          <Entity>
            <RadioOption value="large" />
            <Entity>
              <RadioIndicator />
            </Entity>
            <Entity>
              <TextSpan content="Large" />
            </Entity>
          </Entity>

          <Entity>
            <RadioOption value="xlarge" except={[Clickable]} />
            <Disabled />
            <Entity>
              <RadioIndicator />
            </Entity>
            <Entity>
              <TextSpan content="X-Large (sold out)" />
            </Entity>
          </Entity>
        </Entity>
      </Entity>

      {/* Cat Fetcher Demo */}
      <Entity>
        <DOMElement tag="section" />
        <Classes list={['demo-section']} />

        <Entity>
          <DOMElement tag="h1" />
          <TextContent value="Cat Fetcher Demo" />
        </Entity>

        <Entity>
          <CatDisplay />

          <Entity>
            <FetchCatBtn label="Fetch a Cat!" />
          </Entity>
        </Entity>
      </Entity>
    </Entity>
  );

  // Materialize JSX into entities
  const rootEntity = materialize(world, ui);

  createDebugUI(world);

  // Flush to trigger all reactive systems
  world.flush();

  if (rootEntity && !Array.isArray(rootEntity)) {
    console.log('Mounted! Try the demos.');
  } else {
    console.error('Failed to mount - check root entity');
  }
}

// biome-ignore lint/style/noRestrictedGlobals: entry point for browser runtime
const doc = document;
// biome-ignore lint/style/noRestrictedGlobals: entry point for browser runtime
const fetchFn = fetch;

startPlayground({ doc, fetchFn });
