import { Routes } from '@angular/router';

import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { ChatComponent } from './components/chat/chat.component';
import { HistoryComponent } from './components/history/history.component';
import { SettingsComponent } from './components/settings/settings.component';
import { AdminDashboardComponent } from './components/admin-dashboard/admin-dashboard.component';

import { authGuard } from './auth.guard';
import { AdminGuard } from './auth/admin.guard';
import { AlreadyAuthGuard } from './auth/already-auth.guard';
import { UserOnlyGuard } from './guards/user-only.guard';

export const routes: Routes = [
  // Pages publiques
  { path: 'login', component: LoginComponent, canActivate: [AlreadyAuthGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [AlreadyAuthGuard] },

  // Redirige la racine vers /chat (évite la duplication)
  { path: '', pathMatch: 'full', redirectTo: 'chat' },

  // Espace utilisateur (auth obligatoire + interdit aux admins)
  { path: 'chat', component: ChatComponent, canActivate: [authGuard, UserOnlyGuard] },
  { path: 'chat/:id', component: ChatComponent, canActivate: [authGuard, UserOnlyGuard] },
  { path: 'new', component: ChatComponent, canActivate: [authGuard, UserOnlyGuard] },

  { path: 'history', component: HistoryComponent, canActivate: [authGuard, UserOnlyGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [authGuard, UserOnlyGuard] },

  // Users (lazy)
  {
    path: 'admin/users',
    loadComponent: () =>
      import('./components/users-page/users-page.component')
        .then(m => m.UsersPageComponent),
    canActivate: [authGuard, AdminGuard],
  },

  // Reset / Password (lazy)
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./auth/reset-password/reset-password.component')
        .then(m => m.ResetPasswordComponent),
  },
  {
    path: 'password',
    loadComponent: () =>
      import('./auth/reset-password/reset-password.component')
        .then(m => m.ResetPasswordComponent),
  },

  // Dashboard Admin
  { path: 'admin', component: AdminDashboardComponent, canActivate: [authGuard, AdminGuard] },

  // Fallback
  { path: '**', redirectTo: 'chat' }
];
