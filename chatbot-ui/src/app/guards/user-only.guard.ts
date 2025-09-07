import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class UserOnlyGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}
  canActivate(): boolean {
    if (this.auth.isAdmin()) {            // admin ? -> on renvoie vers le dashboard admin
      this.router.navigate(['/admin']);
      return false;
    }
    return true;                          // user normal -> ok
  }
}
