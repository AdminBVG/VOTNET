import { Component, inject, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { ConfigService } from '../../core/config.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, NgIf],
  template: `
  <div class="login-container">
    <img [src]="cfg.logoUrl()" class="logo" alt="Logo"/>
    <mat-card>
      <h2>Iniciar sesión</h2>
      <form [formGroup]="form" (ngSubmit)="submit()" class="login-form">
        <mat-form-field appearance="outline" class="full">
          <mat-label>Usuario</mat-label>
          <input matInput formControlName="userName" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Contraseña</mat-label>
          <input matInput type="password" formControlName="password" />
        </mat-form-field>
        <button mat-raised-button color="primary" class="full" [disabled]="form.invalid || loading()">Entrar</button>
        <button mat-stroked-button type="button" class="full" (click)="loginMicrosoft()" [disabled]="loading()">Iniciar con Microsoft</button>
        <div class="error" *ngIf="error()">{{error()}}</div>
      </form>
    </mat-card>
  </div>
  `,
  styles: [`
    .login-container{ position:relative; min-height:100vh; display:flex; justify-content:center; align-items:center; }
    .login-form{ display:flex; flex-direction:column; align-items:stretch; gap:12px }
    .full{ width:280px }
    mat-card{ padding:32px }
    .logo{ position:absolute; top:24px; left:24px; height:48px }
    .error{ color:#c62828; margin-top:8px }
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
    // Eliminar tokens previos para evitar estados raros
    localStorage.removeItem('token');
    this.auth.login(payload as any).subscribe({
      next: r => { this.auth.setToken(r.token); this.router.navigateByUrl('/'); },
      error: err => { this.error.set('Credenciales inválidas'); this.loading.set(false); }
    });
  }

  loginMicrosoft() {
    this.loading.set(true);
    this.error.set(null);
    this.auth.loginWithMicrosoft().subscribe({
      next: r => { this.auth.setToken(r.token); this.router.navigateByUrl('/'); },
      error: err => { this.error.set('Error de Microsoft'); this.loading.set(false); }
    });
  }
}
