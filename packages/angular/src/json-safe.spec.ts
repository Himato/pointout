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

  it('drops functions, nodes, class instances, observables and odd numbers', () => {
    expect(toJsonSafe(() => 0)).toBeUndefined();
    expect(toJsonSafe(document.body)).toBeUndefined();
    expect(toJsonSafe(new Date())).toBeUndefined();
    expect(toJsonSafe({ subscribe: () => undefined })).toBeUndefined();
    expect(toJsonSafe(Number.NaN)).toBeUndefined();
    expect(toJsonSafe(undefined)).toBeUndefined();
  });
});
