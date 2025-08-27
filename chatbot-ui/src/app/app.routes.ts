import { Routes } from '@angular/router';

import { ChatComponent } from './components/chat/chat.component';
import { HistoryComponent } from './components/history/history.component';
import { SettingsComponent } from './components/settings/settings.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { AdminDashboardComponent } from './components/admin-dashboard/admin-dashboard.component';

// ✅ Chemins corrects vers les guards
import { authGuard } from './auth.guard'; 
import { AdminGuard } from './auth/admin.guard';
import { AlreadyAuthGuard } from './auth/already-auth.guard';

// src/app/app.routes.ts
export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [AlreadyAuthGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [AlreadyAuthGuard] },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [AdminGuard] },

  { path: 'chat', component: ChatComponent, canActivate: [authGuard] },
  { path: 'chat/:id', component: ChatComponent, canActivate: [authGuard] },
  { path: 'new', component: ChatComponent, canActivate: [authGuard] }, // ✅ bouton "Nouvelle conv."
{
    path: 'settings',
    canActivate: [authGuard],            // <-- utilise authGuard
    loadComponent: () =>
      import('./components/settings/settings.component')
        .then(m => m.SettingsComponent)
  },
  { path: '', redirectTo: 'chat', pathMatch: 'full' },
  { path: '**', redirectTo: 'chat' }
];

