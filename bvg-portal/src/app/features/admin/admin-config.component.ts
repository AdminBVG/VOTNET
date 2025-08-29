import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-admin-config',
  standalone: true,
  imports: [ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatSnackBarModule],
  template: `
  <div class="page">
    <h2>Configuración</h2>
    <mat-card>
      <h3>Storage</h3>
      <form [formGroup]="form" (ngSubmit)="save()" class="cfg-form">
        <mat-form-field appearance="outline">
          <mat-label>Storage Root</mat-label>
          <input matInput formControlName="storageRoot" placeholder="C:\\BVG\\uploads">
        </mat-form-field>
        <h3>SMTP</h3>
        <mat-form-field appearance="outline">
          <mat-label>Host</mat-label>
          <input matInput formControlName="host">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Puerto</mat-label>
          <input matInput type="number" formControlName="port">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Usuario</mat-label>
          <input matInput formControlName="user">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Remitente (From)</mat-label>
          <input matInput formControlName="from">
        </mat-form-field>
        <div class="actions">
          <button mat-raised-button color="primary" [disabled]="form.invalid">Guardar</button>
        </div>
      </form>
      <div class="note">Nota: cambiar Storage Root requiere reiniciar el backend para aplicar.</div>
    </mat-card>
  </div>
  `,
  styles: [`
    .page{ padding:16px }
    .cfg-form{ display:grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap:12px }
    .actions{ grid-column: 1 / -1; justify-self:end }
    .note{ margin-top:8px; opacity:.75; font-size:13px }
  `]
})
export class AdminConfigComponent{
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  form = this.fb.group({
    storageRoot: ['', Validators.required],
    host: [''], port: [25], user: [''], from: ['']
  });
  constructor(){ this.load(); }
  load(){ this.http.get<any>(`/api/config/`).subscribe(cfg=>{
    this.form.patchValue({
      storageRoot: cfg.storageRoot || '',
      host: cfg.smtp?.host || '',
      port: cfg.smtp?.port || 25,
      user: cfg.smtp?.user || '',
      from: cfg.smtp?.from || ''
    });
  }); }
  save(){ const v = this.form.value as any; const dto = { storageRoot: v.storageRoot, smtp: { host: v.host, port: v.port, user: v.user, from: v.from } }; this.http.put(`/api/config/`, dto).subscribe({ next: _=> this.snack.open('Guardado','OK',{duration:1500}), error: _=> this.snack.open('Error al guardar','OK',{duration:2000}) }); }
}

