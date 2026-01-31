/**
 * Cat fetcher components.
 */

import { defineComponent, defineMarker } from '@ecs-test/ecs';

/** Trigger to fetch a cat */
export const FetchCat = defineMarker('FetchCat');

/** Indicates a fetch is in progress */
export const Loading = defineMarker('Loading');

/** Holds fetched cat data */
export const CatData = defineComponent<{ id: string; tags: string[] }>('CatData');

/** Holds fetch error info */
export const FetchError = defineComponent<{ message: string }>('FetchError');

/** Image source URL */
export const ImageSrc = defineComponent<{ url: string }>('ImageSrc');

/** Marker for a button that triggers cat fetch */
export const FetchCatButton = defineMarker('FetchCatButton');

/** Marker for a CatDisplay container */
export const CatDisplayMarker = defineMarker('CatDisplayMarker');
