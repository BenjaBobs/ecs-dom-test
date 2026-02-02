import { describe, expect, it } from 'bun:test';
import { defineComponent, defineMarker, getTag } from './component.ts';

describe('defineComponent', () => {
  it('creates a component type with the given tag', () => {
    const Position = defineComponent<{ x: number; y: number }>('Position');

    expect(Position._tag).toBe('Position');
  });

  it('creates component instances with data', () => {
    const Position = defineComponent<{ x: number; y: number }>('Position');
    const instance = Position({ x: 10, y: 20 });

    expect(instance._tag).toBe('Position');
    expect(instance.data).toEqual({ x: 10, y: 20 });
  });

  it('throws on empty tag', () => {
    expect(() => defineComponent('')).toThrow('Component tag must be a non-empty string');
  });

  it('throws on whitespace-only tag', () => {
    expect(() => defineComponent('   ')).toThrow('Component tag must be a non-empty string');
  });

  it('allows special characters in tags', () => {
    const Component = defineComponent<{ value: number }>('my-component:v2');
    expect(Component._tag).toBe('my-component:v2');
  });
});

describe('defineMarker', () => {
  it('creates a marker component type', () => {
    const Selected = defineMarker('Selected');

    expect(Selected._tag).toBe('Selected');
  });

  it('creates marker instances with no data', () => {
    const Selected = defineMarker('Selected');
    const instance = Selected();

    expect(instance._tag).toBe('Selected');
    expect(instance.data).toBeUndefined();
  });

  it('throws on empty tag', () => {
    expect(() => defineMarker('')).toThrow('Component tag must be a non-empty string');
  });

  it('throws on whitespace-only tag', () => {
    expect(() => defineMarker('   ')).toThrow('Component tag must be a non-empty string');
  });
});

describe('getTag', () => {
  it('returns tag from ComponentType', () => {
    const Position = defineComponent<{ x: number; y: number }>('Position');

    expect(getTag(Position)).toBe('Position');
  });

  it('returns tag from marker ComponentType', () => {
    const Selected = defineMarker('Selected');

    expect(getTag(Selected)).toBe('Selected');
  });

  it('returns string as-is', () => {
    expect(getTag('MyComponent')).toBe('MyComponent');
  });

  it('returns empty string as-is', () => {
    expect(getTag('')).toBe('');
  });
});
