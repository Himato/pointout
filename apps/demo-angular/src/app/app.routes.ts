import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Dashboard',
    loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'settings',
    title: 'Settings',
    loadComponent: () => import('./settings/settings').then((m) => m.Settings),
  },
  { path: '**', redirectTo: '' },
];
