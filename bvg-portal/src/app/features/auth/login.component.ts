import { Component, inject, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ConfigService } from '../../core/config.service';
import { UiButtonDirective } from '../../ui/button.directive';
import { UiInputDirective } from '../../ui/input.directive';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, UiButtonDirective, UiInputDirective],
  template: `
  <div class="min-h-screen flex items-center justify-center bg-surface">
    <img [src]="cfg.logoUrl()" class="fixed top-6 left-6 h-12" alt="Logo"/>
    <div class="card w-[320px]">
      <h2 class="text-lg font-semibold mb-2">Iniciar sesiÃ³n</h2>
      <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-2">
        <label class="text-xs opacity-80">Usuario</label>
        <input uiInput formControlName="userName" />
        <label class="text-xs opacity-80">ContraseÃ±a</label>
        <input uiInput type="password" formControlName="password" />
        <button uiBtn="primary" [disabled]="form.invalid || loading()">Entrar</button>
        <button uiBtn="secondary" type="button" (click)="loginMicrosoft()" [disabled]="loading()">Iniciar con Microsoft</button>
        <div class="text-sm text-red-700" *ngIf="error()">{{error()}}</div>
      </form>
    </div>
  </div>
  `,
  styles: [`
    .card{ padding:32px; background:#fff; border:1px solid #eaeef5; border-radius:16px; box-shadow: 0 8px 24px rgba(0,0,0,.05) }
  `]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  cfg = inject(ConfigService);

  loading = signal(false);
  error = signal<string | null>(null);

  form = this.fb.group({ userName: ['', Validators.required], password: ['', Validators.required] });

  constructor(){
    if (this.auth.isAuthenticated) this.router.navigateByUrl('/');
  }

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const payload = {
      userName: (this.form.value.userName || '').trim(),
      password: (this.form.value.password || '').trim()
    };
    localStorage.removeItem('token');
    this.auth.login(payload as any).subscribe({
      next: r => { this.auth.setToken(r.token); this.router.navigateByUrl('/'); },
      error: _ => { this.error.set('Credenciales invÃ¡lidas'); this.loading.set(false); }
    });
  }

  loginMicrosoft() {
    this.loading.set(true);
    this.error.set(null);
    this.auth.loginWithMicrosoft().subscribe({
      next: r => { this.auth.setToken(r.token); this.router.navigateByUrl('/'); },
      error: _ => { this.error.set('Error de Microsoft'); this.loading.set(false); }
    });
  }
}


