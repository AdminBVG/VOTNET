import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  // Evitar adjuntar Authorization en endpoints de auth
  const isAuthEndpoint = req.url.startsWith('/api/auth');
  const token = isAuthEndpoint ? null : localStorage.getItem('token');
  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req).pipe(
    catchError(err => {
      if (err.status === 401) {
        localStorage.removeItem('token');
        router.navigateByUrl('/login');
      }
      // En 403 no cerramos sesión; dejar que la vista maneje autorización
      return throwError(() => err);
    })
  );
};
