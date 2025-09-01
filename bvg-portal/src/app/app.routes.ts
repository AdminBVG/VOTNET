import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent) },
  { path: '', loadComponent: () => import('./layout/shell.component').then(m => m.ShellComponent), canActivate: [authGuard], children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'elections', loadComponent: () => import('./features/elections/elections.component').then(m => m.ElectionsComponent) },
      { path: 'attendance', loadComponent: () => import('./features/attendance/attendance-list.component').then(m => m.AttendanceListComponent) },
      { path: 'attendance/:id/overview', loadComponent: () => import('./features/attendance/attendance-overview.component').then(m => m.AttendanceOverviewComponent) },
      { path: 'attendance/:id/history', loadComponent: () => import('./features/attendance/attendance-history.component').then(m => m.AttendanceHistoryComponent) },
      { path: 'attendance/:id/requirements', loadComponent: () => import('./features/attendance/attendance-requirements.component').then(m => m.AttendanceRequirementsComponent) },
      { path: 'attendance/:id/register', loadComponent: () => import('./features/attendance/attendance-register.component').then(m => m.AttendanceRegisterComponent) },
      // Removed legacy elections list view; wizard replaces it
      { path: 'elections/live', loadComponent: () => import('./features/elections/results-live.component').then(m => m.ResultsLiveComponent) },
      { path: 'elections/new', loadComponent: () => import('./features/elections/election-wizard.component').then(m => m.ElectionWizardComponent) },
      { path: 'elections/:id', loadComponent: () => import('./features/elections/election-detail.component').then(m => m.ElectionDetailComponent) },
      { path: 'users', loadComponent: () => import('./features/users/users.component').then(m => m.UsersComponent) },
      { path: 'config', loadComponent: () => import('./features/admin/admin-config.component').then(m => m.AdminConfigComponent) },
    ]
  },
  { path: '**', redirectTo: '' }
];
