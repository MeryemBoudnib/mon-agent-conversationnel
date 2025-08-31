import { Component, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { MatSidenav } from '@angular/material/sidenav';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { SidebarComponent } from './sidebar/sidebar/sidebar.component';
import { AuthService } from './auth/auth.service';

type ThemeMode = 'light' | 'dark';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatIconModule,
    MatSidenavModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
    MatSlideToggleModule,
    SidebarComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild('sidenav', { static: false }) sidenav?: MatSidenav;

  currentRoute = '';
  email: string | null = null;
  displayName: string | null = null;
  avatarUrl: string | null = null;
  isLoggedIn = false;

  // 🌙/☀️ Thème
  themeMode: ThemeMode = 'light';
  private mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  private subs = new Subscription();

  constructor(private router: Router, private auth: AuthService) {
    this.currentRoute = this.router.url || '';
    this.subs.add(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe(e => {
          this.currentRoute = e.urlAfterRedirects || e.url || '';
          this.refreshUser();
        })
    );
  }

  ngOnInit(): void {
    this.refreshUser();

    // Events auth
    this.subs.add(this.auth.authChanged$.subscribe(() => this.refreshUser()));
    window.addEventListener('storage', this.onStorage);

    // ----- Thème : init -----
    const saved = (localStorage.getItem('theme') as ThemeMode) || null;
    if (saved) {
      this.themeMode = saved;
    } else {
      // première fois => suivre système
      this.themeMode = this.mediaQuery.matches ? 'dark' : 'light';
    }
    this.applyTheme(this.themeMode);

    // Réagit si système change (optionnel : on force si pas de préférence sauvegardée)
    this.mediaQuery.addEventListener?.('change', this.onSystemThemeChange);
  }

  ngOnDestroy(): void {
    window.removeEventListener('storage', this.onStorage);
    this.mediaQuery.removeEventListener?.('change', this.onSystemThemeChange);
    this.subs.unsubscribe();
  }

  private onStorage = (e: StorageEvent) => {
    if (e.key === 'access_token') this.refreshUser();
    if (e.key === 'theme') {
      const incoming = (e.newValue as ThemeMode) || 'light';
      this.setTheme(incoming);
    }
  };

  private onSystemThemeChange = () => {
    // si aucun choix enregistré, on suit le système
    if (!localStorage.getItem('theme')) {
      this.setTheme(this.mediaQuery.matches ? 'dark' : 'light');
    }
  };

  /** Recharge email + nom affiché depuis AuthService/JWT/localStorage */
  private refreshUser(): void {
    this.email = this.auth.getEmail();
    this.isLoggedIn = !!this.email && this.auth.isLoggedIn();
    this.displayName = this.computeDisplayName(this.email);
  }

  private computeDisplayName(email: string | null): string | null {
    if (!email) return null;
    const left = email.split('@')[0] || '';
    return left
      .split(/[._-]+/)
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  logout(): void {
    this.auth.logout();
    this.refreshUser();
    this.router.navigate(['/login']);
  }

  goToSettings(): void {
    this.router.navigate(['/settings']);
  }

  isShellRoute(): boolean {
    const url = this.currentRoute || '';
    return !(url.startsWith('/login') || url.startsWith('/register') || url.startsWith('/admin'));
  }

  toggleSidebar(): void {
    this.sidenav?.toggle();
  }

  // --------------------- Thème ---------------------
  private applyTheme(mode: ThemeMode) {
    const root = document.documentElement;
    if (mode === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
    root.style.colorScheme = mode;
  }

  setTheme(mode: ThemeMode) {
    this.themeMode = mode;
    localStorage.setItem('theme', mode);
    this.applyTheme(mode);
  }

  onToggleDark(checked: boolean) {
    this.setTheme(checked ? 'dark' : 'light');
  }

  getEffectiveMode(): ThemeMode {
    return this.themeMode;
  }
}
