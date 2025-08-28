// src/app/app.routes.ts
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

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [AlreadyAuthGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [AlreadyAuthGuard] },

  // 👇 Chat principal (là où on uploade aussi)
  { path: '', pathMatch: 'full', component: ChatComponent, canActivate: [authGuard] },
 { path: 'chat/:id', component: ChatComponent, canActivate: [authGuard] },
  { path: 'new', component: ChatComponent, canActivate: [authGuard] }, // ✅ bouton "Nouvelle conv."
  { path: 'history', component: HistoryComponent, canActivate: [authGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },

  // Admin
  { path: 'admin', component: AdminDashboardComponent, canActivate: [authGuard, AdminGuard] },

  // fallback
  { path: '**', redirectTo: '' }
];
