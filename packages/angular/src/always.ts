import type { EnvironmentProviders } from '@angular/core';
import { pointoutInitializer } from './initializer';
import type { AngularPointoutOptions } from './mount';

export type { AngularPointoutOptions } from './mount';

/** Pointout in every build. Handy for staging. Angular 15+. */
export function providePointoutAlways(options: AngularPointoutOptions = {}): EnvironmentProviders {
  return pointoutInitializer(options, () => import('./index'));
}
