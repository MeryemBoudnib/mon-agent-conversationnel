import { Injectable, inject } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';

export type AppTheme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private overlay = inject(OverlayContainer);

  setTheme(theme: AppTheme) {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    this.overlay.getContainerElement().setAttribute('data-theme', theme);
  }

  init(theme: AppTheme = 'light') { this.setTheme(theme); }

  toggle() {
    const curr = (document.documentElement.getAttribute('data-theme') || 'light') as AppTheme;
    this.setTheme(curr === 'light' ? 'dark' : 'light');
  }
}
