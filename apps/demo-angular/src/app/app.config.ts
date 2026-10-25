import { provideBrowserGlobalErrorListeners, type ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { providePointout } from '@point-out/angular/providers';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    providePointout({ appName: 'Pointout demo', server: true }),
  ],
};
