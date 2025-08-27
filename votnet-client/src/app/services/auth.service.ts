import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

type LoginRequest = { username: string; password: string };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'token';
  private _token: string | null = null;

  constructor(private http: HttpClient) {}

  login(data: LoginRequest): Observable<void> {
    return this.http
      .post<{ token: string }>(`${environment.apiBaseUrl}/auth/login`, data)
      .pipe(
        tap(res => {
          this._token = res.token;
          sessionStorage.setItem(this.tokenKey, res.token);
        }),
        catchError((err: HttpErrorResponse) => throwError(() => err))
      );
  }

  get token(): string | null {
    return this._token ?? sessionStorage.getItem(this.tokenKey);
  }

  get isLoggedIn(): boolean {
    return !!this.token;
  }

  private get payload(): any | null {
    const token = this.token;
    if (!token) return null;
    try {
      const base64 = token.split('.')[1];
      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  }

  hasRole(role: string): boolean {
    const p = this.payload;
    const roles = p?.role;
    if (Array.isArray(roles)) return roles.includes(role);
    return roles === role;
  }

  logout(): void {
    this._token = null;
    sessionStorage.removeItem(this.tokenKey);
  }
}
