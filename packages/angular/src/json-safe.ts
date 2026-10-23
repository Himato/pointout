export const MAX_ENTRIES = 20;

type Primitive = string | number | boolean | null;

/** A JSON friendly copy of `value`, or `undefined` when it should be left out of the brief. */
export function toJsonSafe(value: unknown): unknown {
  if (isPrimitive(value)) return value;
  if (Array.isArray(value)) return value.filter(isPrimitive).slice(0, MAX_ENTRIES);
  if (isPlainObject(value) && !isSubscribable(value)) {
    const entries = Object.entries(value).filter(([, v]) => isPrimitive(v));
    return Object.fromEntries(entries.slice(0, MAX_ENTRIES));
  }
  return undefined;
}

/** Signal getters carry Angular's `SIGNAL` symbol. It is a plain `Symbol('SIGNAL')`, so match by description. */
export function isSignal(value: unknown): value is () => unknown {
  if (typeof value !== 'function') return false;
  return Object.getOwnPropertySymbols(value).some((s) => s.description === 'SIGNAL');
}

function isSubscribable(value: Record<string, unknown>): boolean {
  return typeof value['subscribe'] === 'function';
}

function isPrimitive(value: unknown): value is Primitive {
  if (value === null) return true;
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'string' || typeof value === 'boolean';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}
