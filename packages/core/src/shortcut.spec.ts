import { describe, expect, it } from 'vitest';
import { createShortcutMatcher, isMacPlatform, parseShortcut } from './shortcut';

const press = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);

describe('parseShortcut', () => {
  it('parses Mod+Shift+F', () => {
    expect(parseShortcut('Mod+Shift+F', false)).toEqual({
      key: 'f',
      ctrl: true,
      meta: false,
      shift: true,
      alt: false,
    });
  });

  it('maps Mod to Meta on macOS and Ctrl elsewhere', () => {
    expect(parseShortcut('Mod+K', true)).toMatchObject({ meta: true, ctrl: false });
    expect(parseShortcut('Mod+K', false)).toMatchObject({ meta: false, ctrl: true });
  });
});

describe('isMacPlatform', () => {
  it('reads the platform', () => {
    expect(isMacPlatform({ platform: 'MacIntel' } as Navigator)).toBe(true);
    expect(isMacPlatform({ platform: 'Win32' } as Navigator)).toBe(false);
    expect(
      isMacPlatform({ platform: '', userAgentData: { platform: 'macOS' } } as unknown as Navigator),
    ).toBe(true);
  });
});

describe('createShortcutMatcher', () => {
  it('matches Cmd+Shift+F on macOS', () => {
    const matches = createShortcutMatcher('Mod+Shift+F', true);
    expect(matches(press({ key: 'F', code: 'KeyF', metaKey: true, shiftKey: true }))).toBe(true);
    expect(matches(press({ key: 'F', code: 'KeyF', ctrlKey: true, shiftKey: true }))).toBe(false);
  });

  it('matches Ctrl+Shift+F elsewhere', () => {
    const matches = createShortcutMatcher('Mod+Shift+F', false);
    expect(matches(press({ key: 'F', code: 'KeyF', ctrlKey: true, shiftKey: true }))).toBe(true);
  });

  it('falls back to the physical key when a modifier changes event.key', () => {
    const matches = createShortcutMatcher('Alt+P', true);
    expect(matches(press({ key: 'π', code: 'KeyP', altKey: true }))).toBe(true);
  });

  it('falls back to the physical key on non-Latin layouts', () => {
    const matches = createShortcutMatcher('Mod+Shift+F', false);
    expect(matches(press({ key: 'А', code: 'KeyF', ctrlKey: true, shiftKey: true }))).toBe(true);
  });

  it('follows the layout when the key is already a Latin letter', () => {
    const matches = createShortcutMatcher('Mod+A', false);
    // AZERTY: the key labelled A sits where US has Q, and vice versa.
    expect(matches(press({ key: 'a', code: 'KeyQ', ctrlKey: true }))).toBe(true);
    expect(matches(press({ key: 'q', code: 'KeyA', ctrlKey: true }))).toBe(false);
  });

  it('ignores keys that do not match', () => {
    const matches = createShortcutMatcher('Mod+Shift+F', false);
    expect(matches(press({ key: 'f', code: 'KeyF', ctrlKey: true }))).toBe(false);
    expect(matches(press({ key: 'G', code: 'KeyG', ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(
      matches(press({ key: 'F', code: 'KeyF', ctrlKey: true, shiftKey: true, altKey: true })),
    ).toBe(false);
  });
});
