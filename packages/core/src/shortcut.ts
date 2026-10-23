export type ShortcutMatcher = (event: KeyboardEvent) => boolean;

interface Chord {
  key: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
}

interface NavigatorWithUAData extends Navigator {
  userAgentData?: { platform?: string };
}

export function isMacPlatform(nav: Navigator | undefined = globalThis.navigator): boolean {
  if (!nav) return false;
  const platform = (nav as NavigatorWithUAData).userAgentData?.platform ?? nav.platform ?? '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

export function parseShortcut(spec: string, isMac: boolean): Chord {
  const chord: Chord = { key: '', ctrl: false, meta: false, shift: false, alt: false };
  for (const raw of spec.split('+')) {
    const token = raw.trim().toLowerCase();
    if (token === 'mod') chord[isMac ? 'meta' : 'ctrl'] = true;
    else if (token === 'ctrl' || token === 'control') chord.ctrl = true;
    else if (token === 'meta' || token === 'cmd' || token === 'command') chord.meta = true;
    else if (token === 'shift') chord.shift = true;
    else if (token === 'alt' || token === 'option') chord.alt = true;
    else chord.key = token;
  }
  return chord;
}

export function createShortcutMatcher(spec: string, isMac = isMacPlatform()): ShortcutMatcher {
  const chord = parseShortcut(spec, isMac);
  return (event) =>
    event.ctrlKey === chord.ctrl &&
    event.metaKey === chord.meta &&
    event.shiftKey === chord.shift &&
    event.altKey === chord.alt &&
    keyMatches(event, chord.key);
}

/**
 * Layout first: `event.key` ignoring case. When Option or a non-Latin layout turns the key into
 * something else ('ƒ', 'а'), fall back to the physical letter in `event.code`. A Latin key that
 * simply differs (AZERTY 'q' on the US 'A' key) is a different key, so no fallback there.
 */
function keyMatches(event: KeyboardEvent, key: string): boolean {
  if (!key) return false;
  const typed = event.key?.toLowerCase() ?? '';
  if (typed === key) return true;
  if (/^[a-z]$/.test(typed)) return false;
  return event.code?.toLowerCase() === (/^[a-z]$/.test(key) ? `key${key}` : key);
}
