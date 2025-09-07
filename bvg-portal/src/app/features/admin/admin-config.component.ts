import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { NgIf } from '@angular/common';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

@Component({
  selector: 'app-admin-config',
  standalone: true,
  imports: [ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatSnackBarModule, MatDividerModule, MatSlideToggleModule, NgIf],
  template: `
  <div class="page">
    <h2>ConfiguraciÃ³n</h2>
    <mat-card>
      <form [formGroup]="form" (ngSubmit)="save()" class="cfg-form">
        <h3>Storage</h3>
        <mat-form-field appearance="outline">
          <mat-label>Storage Root</mat-label>
          <input matInput formControlName="storageRoot" placeholder="C:\\BVG\\uploads">
        </mat-form-field>
        <mat-divider></mat-divider>
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
        <mat-divider></mat-divider>
        <h3>Azure AD</h3>
        <mat-form-field appearance="outline">
          <mat-label>Tenant ID</mat-label>
          <input matInput formControlName="tenantId">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Client ID</mat-label>
          <input matInput formControlName="clientId">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Client Secret</mat-label>
          <input matInput formControlName="clientSecret">
        </mat-form-field>
        <mat-divider></mat-divider>
        <h3>Branding</h3>
        <mat-form-field appearance="outline" class="logo-field">
          <mat-label>Logo URL</mat-label>
          <input matInput formControlName="logoUrl">
        </mat-form-field>
        <h3>Seguridad</h3>
        <mat-form-field appearance="outline" class="logo-field">
          <mat-label>Content-Security-Policy</mat-label>
          <textarea matInput formControlName="csp" rows="3" placeholder="default-src 'self'; ..."></textarea>
        </mat-form-field>
        <h3>Firma Digital</h3>
        <mat-slide-toggle formControlName="signingRequire">Requerir firma para certificar</mat-slide-toggle>
        <div class="pfx">
          <input type="file" #pfx accept=".pfx" class="hidden" (change)="onPfx(pfx.files?.[0]||null)">
          <mat-form-field appearance="outline"><mat-label>Alias del perfil</mat-label><input matInput formControlName="signingAlias" placeholder="ej: Junta2025"></mat-form-field><mat-form-field appearance="outline"><mat-label>Contraseña del PFX</mat-label><input matInput type="password" formControlName="pfxPassword"></mat-form-field>
          <button mat-stroked-button type="button" (click)="pfx.click()">Seleccionar PFX</button>
          <button mat-raised-button color="primary" type="button" (click)="uploadPfx()" [disabled]="!pfxFile">Subir PFX</button>
          <div class="muted" *ngIf="pfxPath">PFX cargado: {{pfxPath}}</div>
        </div>
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
    .cfg-form{ display:grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap:12px; align-items:flex-start }
    h3{ grid-column:1 / -1; margin-top:8px }
    mat-divider{ grid-column:1 / -1 }
    .actions{ grid-column: 1 / -1; justify-self:end; margin-top:12px }
    .pfx{ display:flex; align-items:center; gap:8px; grid-column: 1 / -1 }
    .note{ margin-top:8px; opacity:.75; font-size:13px }
  `]
})
export class AdminConfigComponent{
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  form = this.fb.group({
    storageRoot: ['', Validators.required],
    host: [''], port: [25], user: [''], from: [''],
    tenantId: [''], clientId: [''], clientSecret: [''],
    logoUrl: [''],
    csp: [''],
    signingRequire: [false],
    pfxPassword: [''],
    signingAlias: ['']
  });
  pfxFile: File | null = null;
  pfxPath: string = '';
  profiles: any[] = [];
  constructor(){ this.load(); }
  load(){ this.http.get<any>(`/api/config/admin`).subscribe(cfg=>{
    this.form.patchValue({
      storageRoot: cfg.storageRoot || '',
      host: cfg.smtp?.host || '',
      port: cfg.smtp?.port || 25,
      user: cfg.smtp?.user || '',
      from: cfg.smtp?.from || '',
      tenantId: cfg.azureAd?.tenantId || '',
      clientId: cfg.azureAd?.clientId || '',
      clientSecret: cfg.azureAd?.clientSecret || '',
      logoUrl: cfg.branding?.logoUrl || '',
      csp: cfg.security?.csp || '',
      signingRequire: !!cfg.signing?.requireForCertification
    });
    this.pfxPath = cfg.signing?.defaultPfxPath || '';
    this.loadProfiles();
  }); }
  loadProfiles(){ this.http.get<any[]>(`/api/signing/profiles`).subscribe({ next: d=> this.profiles = d || [], error: _=> this.profiles = [] }); }
  save(){ const v = this.form.value as any; const dto = { storageRoot: v.storageRoot, smtp: { host: v.host, port: v.port, user: v.user, from: v.from }, azureAd: { tenantId: v.tenantId, clientId: v.clientId, clientSecret: v.clientSecret }, branding: { logoUrl: v.logoUrl }, security: { csp: v.csp }, signing: { requireForCertification: !!v.signingRequire, defaultPfxPath: this.pfxPath } }; this.http.put(`/api/config/`, dto).subscribe({ next: _=> this.snack.open('Guardado','OK',{duration:1500}), error: _=> this.snack.open('Error al guardar','OK',{duration:2000}) }); }
  onPfx(f: File | null){ this.pfxFile = f; }
  uploadPfx(){ if (!this.pfxFile) return; const fd = new FormData(); fd.append('file', this.pfxFile); fd.append('password', this.form.value.pfxPassword || ''); fd.append('alias', this.form.value.signingAlias || 'default'); this.http.post<any>(`/api/signing/profiles`, fd).subscribe({ next: _=> { this.snack.open('Perfil cargado','OK',{duration:1500}); this.loadProfiles(); }, error: _=> this.snack.open('Error al cargar perfil','OK',{duration:2000}) }); }
}

