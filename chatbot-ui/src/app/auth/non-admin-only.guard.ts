// src/app/auth/non-admin-only.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class NonAdminOnlyGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean | UrlTree {
    // Doit être connecté (la route a déjà authGuard en plus, mais on garde la ceinture)
    if (!this.auth.isLoggedIn()) {
      return this.router.createUrlTree(['/login']);
    }
    // Si admin -> redirige vers /admin (interdit /chat & co)
    if (this.auth.isAdmin()) {
      return this.router.createUrlTree(['/admin']);
    }
    // Sinon (user) autorisé
    return true;
  }
}
