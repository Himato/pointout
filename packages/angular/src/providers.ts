import {
  APP_INITIALIZER,
  inject,
  makeEnvironmentProviders,
  type EnvironmentProviders,
} from '@angular/core';
import { Router } from '@angular/router';
import type { AngularPointoutOptions } from './mount';

export type { AngularPointoutOptions } from './mount';

declare const ngDevMode: boolean | undefined;

/** Pointout in dev builds, nothing at all in production. Angular 15+. */
export function providePointout(options: AngularPointoutOptions = {}): EnvironmentProviders {
  // The CLI defines ngDevMode as false in prod, so this branch and its lazy chunk fold away.
  if (typeof ngDevMode === 'undefined' || ngDevMode) return providePointoutAlways(options);
  return makeEnvironmentProviders([]);
}

/** Pointout in every build. Handy for staging. Angular 15+. */
export function providePointoutAlways(options: AngularPointoutOptions = {}): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: () => {
        const router = inject(Router, { optional: true });
        return async () => {
          const { mountPointoutForAngular } = await import('./index');
          mountPointoutForAngular({
            ...options,
            resolveUrl: router ? () => router.url : options.resolveUrl,
          });
        };
      },
    },
  ]);
}
