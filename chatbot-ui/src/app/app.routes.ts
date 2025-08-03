import { Routes }               from '@angular/router';
import { ChatComponent }        from './components/chat/chat.component';
import { HistoryComponent }     from './components/history/history.component';
import { SettingsComponent }    from './components/settings/settings.component';
import { LoginComponent }       from './components/login/login.component';
import { RegisterComponent }    from './components/register/register.component';

export const routes: Routes = [
  { path: 'chat',      component: ChatComponent },
  { path: 'chat/:id',   component: ChatComponent },
  { path: 'historique', component: HistoryComponent },
  { path: 'parametres', component: SettingsComponent },
  { path: 'login',      component: LoginComponent },
  { path: 'register',   component: RegisterComponent },
  { path: '',           redirectTo: 'login', pathMatch: 'full' },
  { path: '**',         redirectTo: 'login' }
];
