import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

export interface LoginDto { userName: string; password: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  get token(): string | null { return localStorage.getItem('token'); }
  get isAuthenticated(): boolean { return !!this.token; }
  get payload(): any | null {
    const t = this.token; if (!t) return null;
    const parts = t.split('.'); if (parts.length < 2) return null;
    try { return JSON.parse(atob(parts[1])); } catch { return null; }
  }
  get roles(): string[] {
    const p = this.payload; if (!p) return [];
    // roles can arrive as 'role', 'roles' or the full claim type URI
    const raw = (p['role'] ?? p['roles'] ?? p['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']) as any;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [String(raw)];
  }
  hasRole(role: string): boolean { return this.roles.includes(role); }

  login(dto: LoginDto) {
    return this.http.post<{ token: string }>(`/api/auth/login`, dto);
  }

  setToken(token: string) { localStorage.setItem('token', token); }
  logout() { localStorage.removeItem('token'); this.router.navigateByUrl('/login'); }

  // Solicita al backend que emita cookie/token XSRF para el SPA
  ensureXsrfToken(){
    return this.http.get<{ token: string }>(`/api/antiforgery/token`);
  }
}
