export const MAX_ENTRIES = 20;

type Primitive = string | number | boolean | null;

/**
 * A JSON friendly copy of `value`, one level deep, or `undefined` when it should stay out of the
 * brief. Nothing nested is followed, so cycles cannot happen.
 */
export function toJsonSafe(value: unknown): unknown {
  const primitive = toPrimitive(value);
  if (primitive !== undefined) return primitive;
  if (Array.isArray(value)) return keepPrimitives(value).slice(0, MAX_ENTRIES);
  if (isPlainObject(value) && !isSubscribable(value)) {
    const entries = Object.entries(value).map(([k, v]) => [k, toPrimitive(v)] as const);
    return Object.fromEntries(entries.filter(([, v]) => v !== undefined).slice(0, MAX_ENTRIES));
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

/** Dates become ISO strings, like `JSON.stringify` would make them. */
function toPrimitive(value: unknown): Primitive | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  return undefined;
}

function keepPrimitives(values: unknown[]): Primitive[] {
  return values.map(toPrimitive).filter((v): v is Primitive => v !== undefined);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}
