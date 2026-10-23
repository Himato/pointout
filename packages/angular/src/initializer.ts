import {
  APP_INITIALIZER,
  inject,
  makeEnvironmentProviders,
  type EnvironmentProviders,
} from '@angular/core';
import { Router } from '@angular/router';
import type { AngularPointoutOptions } from './mount';

type PointoutModule = typeof import('./index');

/** The APP_INITIALIZER that mounts Pointout. The caller owns the `import()`. */
export function pointoutInitializer(
  options: AngularPointoutOptions,
  load: () => Promise<PointoutModule>,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: () => {
        const router = inject(Router, { optional: true });
        return async () => {
          const { mountPointoutForAngular } = await load();
          mountPointoutForAngular({
            ...options,
            resolveUrl: options.resolveUrl ?? (router ? () => router.url : undefined),
          });
        };
      },
    },
  ]);
}
