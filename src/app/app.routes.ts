import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/landing/landing.component').then((m) => m.LandingComponent),
    title: 'High Performance Coaching — Mallika Rao | Navigate Transitions with Calm Clarity'
  },
  {
    path: 'crm-portal',
    loadComponent: () =>
      import('./pages/crm-portal/crm-portal.component').then((m) => m.CrmPortalComponent),
    title: 'Executive CRM & Schedule Portal — Mallika Rao'
  },
  {
    path: '**',
    redirectTo: ''
  }
];

