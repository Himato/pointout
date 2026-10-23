import { computed, signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { isSignal, toJsonSafe } from './json-safe';

describe('isSignal', () => {
  it('recognises real Angular signals and nothing else', () => {
    expect(isSignal(signal(1))).toBe(true);
    expect(isSignal(computed(() => 2))).toBe(true);
    expect(isSignal(() => 1)).toBe(false);
    expect(isSignal({})).toBe(false);
  });
});

describe('toJsonSafe', () => {
  it('keeps primitives and shallow plain data', () => {
    expect(toJsonSafe('a')).toBe('a');
    expect(toJsonSafe(null)).toBeNull();
    expect(toJsonSafe([1, 'b', {}, () => 0])).toEqual([1, 'b']);
    expect(toJsonSafe({ a: 1, b: { c: 2 } })).toEqual({ a: 1 });
  });

  it('turns valid dates into ISO strings', () => {
    const at = new Date('2026-10-23T09:00:00.000Z');
    expect(toJsonSafe(at)).toBe('2026-10-23T09:00:00.000Z');
    expect(toJsonSafe({ at, never: new Date(Number.NaN) })).toEqual({ at: at.toISOString() });
  });

  it('leaves cycles behind instead of following them', () => {
    const loop: Record<string, unknown> = { name: 'loop' };
    loop['self'] = loop;
    expect(toJsonSafe(loop)).toEqual({ name: 'loop' });
  });

  it('drops functions, nodes, class instances, observables and odd numbers', () => {
    expect(toJsonSafe(() => 0)).toBeUndefined();
    expect(toJsonSafe(document.body)).toBeUndefined();
    expect(toJsonSafe(new Date(Number.NaN))).toBeUndefined();
    expect(toJsonSafe({ subscribe: () => undefined })).toBeUndefined();
    expect(toJsonSafe(Number.NaN)).toBeUndefined();
    expect(toJsonSafe(undefined)).toBeUndefined();
  });
});
