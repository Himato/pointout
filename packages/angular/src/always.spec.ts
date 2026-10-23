import { Injector, runInInjectionContext } from '@angular/core';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { mountPointout } from '@pointout/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { providePointoutAlways } from './always';

// The real router is partially compiled and needs the JIT compiler. A token is all we need.
vi.mock('@angular/router', () => ({ Router: class Router {} }));
vi.mock('@pointout/core', () => ({ mountPointout: vi.fn() }));

const { Router } = await import('@angular/router');

type DevModeGlobal = { ngDevMode?: unknown };
const devGlobal = globalThis as DevModeGlobal;
// Angular itself sets ngDevMode when it loads, so put its value back rather than deleting it.
const angularDevMode = devGlobal.ngDevMode;
type Initializer = { provide: unknown; useFactory: () => () => Promise<void> };

const providersOf = (p: EnvironmentProviders) =>
  (p as unknown as { ɵproviders: Initializer[] }).ɵproviders;

async function runInitializer(providers: Provider[]): Promise<void> {
  const [initializer] = providersOf(providePointoutAlways({ appName: 'Demo' }));
  const injector = Injector.create({ providers });
  await runInInjectionContext(injector, initializer!.useFactory)();
}

afterEach(() => {
  devGlobal.ngDevMode = angularDevMode;
  vi.mocked(mountPointout).mockClear();
});

describe('providePointoutAlways', () => {
  it('still provides in every build', () => {
    devGlobal.ngDevMode = false;

    expect(providersOf(providePointoutAlways())).toHaveLength(1);
  });
});

describe('the initializer', () => {
  it('mounts with router.url when a Router is around', async () => {
    await runInitializer([{ provide: Router, useValue: { url: '/from-router' } }]);

    const options = vi.mocked(mountPointout).mock.lastCall![0];
    expect(options.appName).toBe('Demo');
    expect(options.resolveUrl!()).toBe('/from-router');
  });

  it('falls back to location without a Router', async () => {
    history.replaceState(null, '', '/plain?x=1');

    await runInitializer([]);

    expect(vi.mocked(mountPointout).mock.lastCall![0].resolveUrl!()).toBe('/plain?x=1');
  });
});
