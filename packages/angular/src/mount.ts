import { mountPointout, type PointoutHandle, type PointoutOptions } from '@point-out/core';
import { angularOwnerResolver } from './resolver';

/** `PointoutOptions` without `resolveOwner`, and `appName` falls back to `document.title`. */
export type AngularPointoutOptions = Omit<PointoutOptions, 'resolveOwner' | 'appName'> & {
  /** Defaults to `document.title`. */
  appName?: string;
};

/** `mountPointout` with the Angular resolver wired in. Works on any Angular version. */
export function mountPointoutForAngular(options: AngularPointoutOptions = {}): PointoutHandle {
  return mountPointout({
    ...options,
    appName: options.appName ?? (typeof document === 'undefined' ? '' : document.title),
    resolveOwner: angularOwnerResolver,
  });
}
