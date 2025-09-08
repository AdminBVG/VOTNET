import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { NgIf, NgFor, DatePipe, SlicePipe } from '@angular/common';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-config',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatSnackBarModule, MatDividerModule, MatSlideToggleModule, MatTableModule, MatIconModule, MatSelectModule, NgIf, NgFor, DatePipe, SlicePipe],
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
        <div class="csp">
          <div class="row">
            <mat-slide-toggle [(ngModel)]="cspAdvanced" [ngModelOptions]="{standalone:true}">Editor avanzado CSP</mat-slide-toggle>
            <span class="spacer"></span>
            <button mat-stroked-button type="button" (click)="applyPreset('strict')">Preset estricto</button>
            <button mat-stroked-button type="button" (click)="applyPreset('default')">Preset por defecto</button>
            <button mat-stroked-button type="button" (click)="applyPreset('dev')">Preset desarrollo</button>
          </div>
          <ng-container *ngIf="!cspAdvanced; else advancedCspTpl">
            <mat-form-field appearance="outline" class="logo-field">
              <mat-label>Content-Security-Policy</mat-label>
              <textarea matInput formControlName="csp" rows="3" placeholder="default-src 'self'; ..."></textarea>
            </mat-form-field>
          </ng-container>
          <ng-template #advancedCspTpl>
            <div class="grid-2">
              <mat-form-field appearance="outline">
                <mat-label>default-src</mat-label>
                <input matInput [ngModel]="cspForm.default" (ngModelChange)="setCsp('default', $event)" [ngModelOptions]="{standalone:true}" placeholder="'self'">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>script-src</mat-label>
                <input matInput [ngModel]="cspForm.script" (ngModelChange)="setCsp('script', $event)" [ngModelOptions]="{standalone:true}" placeholder="'self' 'unsafe-inline'">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>style-src</mat-label>
                <input matInput [ngModel]="cspForm.style" (ngModelChange)="setCsp('style', $event)" [ngModelOptions]="{standalone:true}" placeholder="'self' 'unsafe-inline'">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>img-src</mat-label>
                <input matInput [ngModel]="cspForm.img" (ngModelChange)="setCsp('img', $event)" [ngModelOptions]="{standalone:true}" placeholder="'self' data:">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>connect-src</mat-label>
                <input matInput [ngModel]="cspForm.connect" (ngModelChange)="setCsp('connect', $event)" [ngModelOptions]="{standalone:true}" placeholder="'self'">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>frame-ancestors</mat-label>
                <input matInput [ngModel]="cspForm.frames" (ngModelChange)="setCsp('frames', $event)" [ngModelOptions]="{standalone:true}" placeholder="'none'">
              </mat-form-field>
            </div>
            <div class="preview" [class.invalid]="!validCsp">
              <div class="label">Header resultante:</div>
              <code>{{ builtCsp }}</code>
              <div class="err" *ngIf="!validCsp">CSP incompleto: agrega al menos default-src o script/style con 'self'.</div>
            </div>
          </ng-template>
        </div>
        <div class="profiles">
          <table mat-table [dataSource]="profiles" class="mat-elevation-z1" *ngIf="profiles.length">
            <ng-container matColumnDef="alias">
              <th mat-header-cell *matHeaderCellDef>Alias</th>
              <td mat-cell *matCellDef="let p">{{p.alias}}</td>
            </ng-container>
            <ng-container matColumnDef="subject">
              <th mat-header-cell *matHeaderCellDef>Sujeto</th>
              <td mat-cell *matCellDef="let p">{{p.subject || p.Subject}}</td>
            </ng-container>
            <ng-container matColumnDef="thumb">
              <th mat-header-cell *matHeaderCellDef>Huella</th>
              <td mat-cell *matCellDef="let p"><code>{{(p.thumbprint || p.Thumbprint) | slice:0:20}}…</code></td>
            </ng-container>
            <ng-container matColumnDef="notafter">
              <th mat-header-cell *matHeaderCellDef>Válido hasta</th>
              <td mat-cell *matCellDef="let p">{{(p.notAfter || p.NotAfter) | date:'short'}}</td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let p">
                <button mat-icon-button color="warn" (click)="deleteProfile(p.alias)" aria-label="Eliminar perfil"><mat-icon>delete</mat-icon></button>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="['alias','subject','thumb','notafter','actions']"></tr>
            <tr mat-row *matRowDef="let row; columns: ['alias','subject','thumb','notafter','actions'];"></tr>
          </table>
          <div class="muted" *ngIf="!profiles.length">Sin perfiles aún.</div>
        </div>
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
    .profiles{ grid-column: 1 / -1 }
    .csp{ grid-column: 1 / -1 }
    .csp .row{ display:flex; align-items:center; gap:8px }
    .csp .row .spacer{ flex:1 }
    .grid-2{ display:grid; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); gap:12px }
    .preview{ grid-column: 1 / -1; background:#fafafa; border:1px solid #eee; padding:8px; border-radius:4px }
    .preview.invalid{ border-color:#ffcdd2; background:#fff8f8 }
    .preview .label{ font-weight:600; margin-bottom:4px }
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
  cspAdvanced = false;
  cspForm: any = { default: "'self'", script: "'self' 'unsafe-inline'", style: "'self' 'unsafe-inline'", img: "'self' data:", connect: "'self'", frames: "'none'" };
  builtCsp = '';
  validCsp = true;
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
    this.fromCspString(this.form.value.csp || '');
  }); }
  loadProfiles(){ this.http.get<any[]>(`/api/signing/profiles`).subscribe({ next: d=> this.profiles = d || [], error: _=> this.profiles = [] }); }
  save(){ const v = this.form.value as any; const dto = { storageRoot: v.storageRoot, smtp: { host: v.host, port: v.port, user: v.user, from: v.from }, azureAd: { tenantId: v.tenantId, clientId: v.clientId, clientSecret: v.clientSecret }, branding: { logoUrl: v.logoUrl }, security: { csp: v.csp }, signing: { requireForCertification: !!v.signingRequire, defaultPfxPath: this.pfxPath } }; this.http.put(`/api/config/`, dto).subscribe({ next: _=> this.snack.open('Guardado','OK',{duration:1500}), error: _=> this.snack.open('Error al guardar','OK',{duration:2000}) }); }
  onPfx(f: File | null){ this.pfxFile = f; }
  uploadPfx(){ if (!this.pfxFile) return; const fd = new FormData(); fd.append('file', this.pfxFile); fd.append('password', this.form.value.pfxPassword || ''); fd.append('alias', this.form.value.signingAlias || 'default'); this.http.post<any>(`/api/signing/profiles`, fd).subscribe({ next: _=> { this.snack.open('Perfil cargado','OK',{duration:1500}); this.loadProfiles(); }, error: _=> this.snack.open('Error al cargar perfil','OK',{duration:2000}) }); }
  deleteProfile(alias: string){ if(!confirm(`Eliminar perfil ${alias}?`)) return; this.http.delete(`/api/signing/profiles/${alias}`).subscribe({ next: _=> { this.snack.open('Perfil eliminado','OK',{duration:1500}); this.loadProfiles(); }, error: err=> this.snack.open(err?.error?.error==='profile_in_use'?'Perfil en uso por una elección':'No se pudo eliminar','OK',{duration:2000}) }); }
  setCsp(k: 'default'|'script'|'style'|'img'|'connect'|'frames', v: string){ (this.cspForm as any)[k] = v; this.buildCspString(); }
  applyPreset(type: 'strict'|'default'|'dev'){
    if (type==='strict') this.cspForm = { default: "'self'", script: "'self'", style: "'self'", img: "'self'", connect: "'self'", frames: "'none'" };
    if (type==='default') this.cspForm = { default: "'self'", script: "'self' 'unsafe-inline'", style: "'self' 'unsafe-inline'", img: "'self' data:", connect: "'self'", frames: "'none'" };
    if (type==='dev') this.cspForm = { default: "'self'", script: "'self' 'unsafe-inline' 'unsafe-eval'", style: "'self' 'unsafe-inline'", img: "'self' data:", connect: "'self' http://localhost:4200 ws://localhost:4200", frames: "'none'" } as any;
    this.buildCspString();
  }
  private buildCspString(){
    const parts: string[] = [];
    const f = this.cspForm;
    if (f.default?.trim()) parts.push(`default-src ${f.default.trim()}`);
    if (f.script?.trim())  parts.push(`script-src ${f.script.trim()}`);
    if (f.style?.trim())   parts.push(`style-src ${f.style.trim()}`);
    if (f.img?.trim())     parts.push(`img-src ${f.img.trim()}`);
    if (f.connect?.trim()) parts.push(`connect-src ${f.connect.trim()}`);
    if (f.frames?.trim())  parts.push(`frame-ancestors ${f.frames.trim()}`);
    this.builtCsp = parts.join('; ');
    this.validCsp = !!(f.default?.includes("'self'") || (f.script?.includes("'self'") && f.style?.includes("'self'")));
    if (this.validCsp){ this.form.patchValue({ csp: this.builtCsp }); }
  }
  private fromCspString(csp: string){
    if (!csp) return; const d: any = { default:"", script:"", style:"", img:"", connect:"", frames:"" };
    csp.split(';').forEach(p=>{ const t = p.trim(); if(!t) return; const i = t.indexOf(' '); if(i<0) return; const k=t.substring(0,i).toLowerCase(); const v=t.substring(i+1).trim();
      if(k==='default-src') d.default=v; else if(k==='script-src') d.script=v; else if(k==='style-src') d.style=v; else if(k==='img-src') d.img=v; else if(k==='connect-src') d.connect=v; else if(k==='frame-ancestors') d.frames=v; });
    this.cspForm = d; this.buildCspString();
  }
}

