import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';

export const AdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const logged = auth.isLoggedIn();
  const admin  = auth.isAdmin();
  console.debug('[AdminGuard] logged=', logged, 'isAdmin=', admin, 'role=', auth.role);

  if (logged && admin) return true;

  // ⚠️ aucune navigation impérative ici
  return router.createUrlTree([logged ? '/chat' : '/login']);
};
