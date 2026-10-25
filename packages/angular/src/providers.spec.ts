import { APP_INITIALIZER, Injector, runInInjectionContext } from '@angular/core';
import type { EnvironmentProviders } from '@angular/core';
import { mountPointout } from '@point-out/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { providePointoutAlways } from './always';
import { providePointout } from './providers';

// The real router is partially compiled and needs the JIT compiler. A token is all we need.
vi.mock('@angular/router', () => ({ Router: class Router {} }));
vi.mock('@point-out/core', () => ({ mountPointout: vi.fn() }));

const { Router } = await import('@angular/router');

type DevModeGlobal = { ngDevMode?: unknown };
const devGlobal = globalThis as DevModeGlobal;
// Angular itself sets ngDevMode when it loads, so put its value back rather than deleting it.
const angularDevMode = devGlobal.ngDevMode;
type Initializer = { provide: unknown; useFactory: () => () => Promise<void> };

const providersOf = (p: EnvironmentProviders) =>
  (p as unknown as { ɵproviders: Initializer[] }).ɵproviders;

afterEach(() => {
  devGlobal.ngDevMode = angularDevMode;
  vi.mocked(mountPointout).mockClear();
});

describe('providePointout', () => {
  it('provides the initializer in dev mode, same as providePointoutAlways', () => {
    devGlobal.ngDevMode = true;

    const dev = providersOf(providePointout()).map((p) => p.provide);

    expect(dev).toEqual([APP_INITIALIZER]);
    expect(dev).toEqual(providersOf(providePointoutAlways()).map((p) => p.provide));
  });

  it('provides nothing when ngDevMode is false', () => {
    devGlobal.ngDevMode = false;

    expect(providersOf(providePointout())).toEqual([]);
  });

  it('mounts with router.url in dev mode', async () => {
    devGlobal.ngDevMode = true;
    const [initializer] = providersOf(providePointout({ appName: 'Demo' }));
    const injector = Injector.create({
      providers: [{ provide: Router, useValue: { url: '/from-router' } }],
    });

    await runInInjectionContext(injector, initializer!.useFactory)();

    const options = vi.mocked(mountPointout).mock.lastCall![0];
    expect(options.appName).toBe('Demo');
    expect(options.resolveUrl!()).toBe('/from-router');
  });
});
