/**
 * Main entry point - ECS UI Demo
 */

import { World, Entity, materialize } from "@ecs-test/ecs";
import {
  registerDOMSystems,
  mount,
  DOMElement,
  Classes,
  Clickable,
  Disabled,
} from "@ecs-test/dom";

import {
  registerRadioSystems,
  RadioGroup,
  RadioOption,
  RadioIndicator,
  TextSpan,
} from "./radio/index.ts";

import {
  registerCatSystems,
  CatDisplay,
  FetchCatBtn,
} from "./cat/index.ts";

// Create the world
const world = new World();

// Register systems (order matters!)
registerDOMSystems(world);
registerRadioSystems(world);
registerCatSystems(world);

// Define the UI using JSX
const ui = (
  <Entity>
    <DOMElement tag="div" />
    <Classes list={["app"]} />

    {/* Radio Group Demo */}
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

    {/* Cat Fetcher Demo */}
    <Entity>
      <CatDisplay />

      <Entity>
        <FetchCatBtn label="Fetch a Cat!" />
      </Entity>
    </Entity>
  </Entity>
);

// Materialize JSX into entities
const rootEntity = materialize(world, ui);

// Flush to trigger all reactive systems
world.flush();

// Mount to DOM
const container = document.getElementById("root");
if (container && rootEntity && !Array.isArray(rootEntity)) {
  mount(world, rootEntity, container);
  console.log("Mounted! Try the radio buttons and cat fetcher.");
} else {
  console.error("Failed to mount - check root entity");
}
