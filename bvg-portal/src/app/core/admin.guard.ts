import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated || !auth.hasRole('GlobalAdmin')) {
    router.navigateByUrl('/');
    return false;
  }
  return true;
}


