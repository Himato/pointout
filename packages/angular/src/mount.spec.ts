import { mountPointout } from '@pointout/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountPointoutForAngular } from './mount';
import { angularOwnerResolver } from './resolver';

vi.mock('@pointout/core', () => ({ mountPointout: vi.fn(() => ({ unmount: vi.fn() })) }));

const mounted = vi.mocked(mountPointout);
const lastOptions = () => mounted.mock.lastCall![0];

afterEach(() => {
  mounted.mockClear();
  history.replaceState(null, '', '/');
});

describe('mountPointoutForAngular', () => {
  it('wires the Angular resolver and leaves the url to the core', () => {
    document.title = 'Shop';

    const handle = mountPointoutForAngular();

    expect(handle).toBe(mounted.mock.results[0]!.value);
    expect(lastOptions()).toMatchObject({ appName: 'Shop', resolveOwner: angularOwnerResolver });
    expect(lastOptions().resolveUrl).toBeUndefined();
  });

  it('respects the caller resolveUrl, appName and other options', () => {
    const resolveUrl = () => '/custom';

    mountPointoutForAngular({ appName: 'Admin', resolveUrl, storage: 'local' });

    expect(lastOptions()).toMatchObject({ appName: 'Admin', resolveUrl, storage: 'local' });
  });
});
