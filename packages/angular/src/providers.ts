import { makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { pointoutInitializer } from './initializer';
import type { AngularPointoutOptions } from './mount';

export type { AngularPointoutOptions } from './mount';

declare const ngDevMode: boolean | undefined;

/** Pointout in dev builds, nothing at all in production. Angular 15+. */
export function providePointout(options: AngularPointoutOptions = {}): EnvironmentProviders {
  // Bundlers emit a chunk for every import() in a module, so it lives only in this foldable branch.
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    return pointoutInitializer(options, () => import('./index'));
  }
  return makeEnvironmentProviders([]);
}
