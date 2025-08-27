import { Injectable } from '@angular/core';
import { CanActivate, CanLoad, Route, UrlSegment, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate, CanLoad {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    return this.check(route.data['roles']);
  }

  canLoad(route: Route, segments: UrlSegment[]): boolean {
    return this.check(route.data && (route.data as any)['roles']);
  }

  private check(roles?: string[]): boolean {
    if (!this.auth.isLoggedIn) {
      this.router.navigate(['/login']);
      return false;
    }
    if (roles && !roles.some(r => this.auth.hasRole(r))) {
      this.router.navigate(['/']);
      return false;
    }
    return true;
  }
}
