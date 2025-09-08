import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor, DatePipe, SlicePipe } from '@angular/common';
import { UiButtonDirective } from '../../ui/button.directive';
import { UiInputDirective } from '../../ui/input.directive';
import { UiSwitchComponent } from '../../ui/switch.component';
import { ToastService } from '../../ui/toast/toast.service';

@Component({
  selector: 'app-admin-config',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, NgIf, NgFor, DatePipe, SlicePipe, UiButtonDirective, UiInputDirective, UiSwitchComponent],
  template: `
  <div class="p-4">
    <h2 class="text-xl font-semibold mb-3">Configuración</h2>
    <div class="rounded-2xl border border-gray-200 bg-white shadow-card p-4">
      <form [formGroup]="form" (ngSubmit)="save()" class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 items-start">
        <h3 class="col-span-full mt-2 text-base font-semibold">Storage</h3>
        <div>
          <label class="text-xs opacity-80">Storage Root</label>
          <input uiInput formControlName="storageRoot" placeholder="C:\\BVG\\uploads">
        </div>
        <div class="col-span-full h-px bg-gray-200 my-1"></div>
        <h3 class="col-span-full mt-2 text-base font-semibold">SMTP</h3>
        <div>
          <label class="text-xs opacity-80">Host</label>
          <input uiInput formControlName="host">
        </div>
        <div>
          <label class="text-xs opacity-80">Puerto</label>
          <input uiInput type="number" formControlName="port">
        </div>
        <div>
          <label class="text-xs opacity-80">Usuario</label>
          <input uiInput formControlName="user">
        </div>
        <div>
          <label class="text-xs opacity-80">Remitente (From)</label>
          <input uiInput formControlName="from">
        </div>
        <div class="col-span-full h-px bg-gray-200 my-1"></div>
        <h3 class="col-span-full mt-2 text-base font-semibold">Azure AD</h3>
        <div>
          <label class="text-xs opacity-80">Tenant ID</label>
          <input uiInput formControlName="tenantId">
        </div>
        <div>
          <label class="text-xs opacity-80">Client ID</label>
          <input uiInput formControlName="clientId">
        </div>
        <div>
          <label class="text-xs opacity-80">Client Secret</label>
          <input uiInput formControlName="clientSecret">
        </div>
        <div class="col-span-full h-px bg-gray-200 my-1"></div>
        <h3 class="col-span-full mt-2 text-base font-semibold">Branding</h3>
        <div class="col-span-full">
          <label class="text-xs opacity-80">Logo URL</label>
          <input uiInput formControlName="logoUrl">
        </div>
        <h3 class="col-span-full mt-2 text-base font-semibold">Seguridad</h3>
        <div class="col-span-full">
          <div class="flex items-center gap-2 mb-2">
            <ui-switch [(ngModel)]="cspAdvanced" [ngModelOptions]="{standalone:true}"></ui-switch>
            <span class="text-sm">Editor avanzado CSP</span>
            <div class="flex-1"></div>
            <button uiBtn="ghost" type="button" (click)="applyPreset('strict')">Preset estricto</button>
            <button uiBtn="ghost" type="button" (click)="applyPreset('default')">Preset por defecto</button>
            <button uiBtn="ghost" type="button" (click)="applyPreset('dev')">Preset desarrollo</button>
          </div>
          <ng-container *ngIf="!cspAdvanced; else advancedCspTpl">
            <label class="text-xs opacity-80">Content-Security-Policy</label>
            <textarea uiInput formControlName="csp" rows="3" placeholder="default-src 'self'; ..."></textarea>
          </ng-container>
          <ng-template #advancedCspTpl>
            <div class="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
              <div><label class="text-xs opacity-80">default-src</label><input uiInput [ngModel]="cspForm.default" (ngModelChange)="setCsp('default',$event)" [ngModelOptions]="{standalone:true}" placeholder="'self'"></div>
              <div><label class="text-xs opacity-80">script-src</label><input uiInput [ngModel]="cspForm.script" (ngModelChange)="setCsp('script',$event)" [ngModelOptions]="{standalone:true}" placeholder="'self' 'unsafe-inline'"></div>
              <div><label class="text-xs opacity-80">style-src</label><input uiInput [ngModel]="cspForm.style" (ngModelChange)="setCsp('style',$event)" [ngModelOptions]="{standalone:true}" placeholder="'self' 'unsafe-inline'"></div>
              <div><label class="text-xs opacity-80">img-src</label><input uiInput [ngModel]="cspForm.img" (ngModelChange)="setCsp('img',$event)" [ngModelOptions]="{standalone:true}" placeholder="'self' data:"></div>
              <div><label class="text-xs opacity-80">connect-src</label><input uiInput [ngModel]="cspForm.connect" (ngModelChange)="setCsp('connect',$event)" [ngModelOptions]="{standalone:true}" placeholder="'self'"></div>
              <div><label class="text-xs opacity-80">frame-ancestors</label><input uiInput [ngModel]="cspForm.frames" (ngModelChange)="setCsp('frames',$event)" [ngModelOptions]="{standalone:true}" placeholder="'none'"></div>
            </div>
            <div class="mt-2 rounded-lg border p-2" [class.border-red-300]="!validCsp" [class.bg-red-50]="!validCsp">
              <div class="font-medium mb-1">Header resultante:</div>
              <code class="text-xs break-words">{{ builtCsp }}</code>
              <div class="text-xs text-red-700 mt-1" *ngIf="!validCsp">CSP incompleto: agrega al menos default-src o script/style con 'self'.</div>
            </div>
          </ng-template>
        </div>
        <h3 class="col-span-full mt-2 text-base font-semibold">Perfiles de firma</h3>
        <div class="col-span-full flex flex-wrap items-center gap-2">
          <input type="file" #pfx accept=".pfx" class="hidden" (change)="onPfx(pfx.files?.[0]||null)">
          <div><label class="text-xs opacity-80">Alias del perfil</label><input uiInput formControlName="signingAlias" placeholder="ej: Junta2025"></div>
          <div><label class="text-xs opacity-80">Contraseña del PFX</label><input uiInput type="password" formControlName="pfxPassword"></div>
          <button uiBtn="secondary" type="button" (click)="pfx.click()">Seleccionar PFX</button>
          <button uiBtn="primary" type="button" (click)="uploadPfx()" [disabled]="!pfxFile">Subir PFX</button>
          <div class="text-sm opacity-70" *ngIf="pfxPath">PFX cargado: {{pfxPath}}</div>
        </div>
        <div class="col-span-full">
          <table class="w-full text-sm border border-gray-200 rounded-xl overflow-hidden" *ngIf="profiles.length">
            <thead class="bg-gray-50 text-gray-600">
              <tr><th class="text-left p-2">Alias</th><th class="text-left p-2">Sujeto</th><th class="text-left p-2">Huella</th><th class="text-left p-2">Válido hasta</th><th class="w-12"></th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of profiles" class="border-t">
                <td class="p-2">{{p.alias}}</td>
                <td class="p-2">{{p.subject || p.Subject}}</td>
                <td class="p-2"><code>{{(p.thumbprint || p.Thumbprint) | slice:0:20}}…</code></td>
                <td class="p-2">{{(p.notAfter || p.NotAfter) | date:'short'}}</td>
                <td class="p-2 text-right"><button uiBtn="danger" size="sm" (click)="deleteProfile(p.alias)">Eliminar</button></td>
              </tr>
            </tbody>
          </table>
          <div class="text-sm opacity-70" *ngIf="!profiles.length">Sin perfiles aún.</div>
        </div>
        <div class="col-span-full justify-self-end mt-2">
          <button uiBtn="primary" [disabled]="form.invalid">Guardar</button>
        </div>
      </form>
      <div class="text-xs opacity-70 mt-2">Nota: cambiar Storage Root requiere reiniciar el backend para aplicar.</div>
    </div>
  </div>
  `
})
export class AdminConfigComponent{
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
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
  save(){ const v = this.form.value as any; const dto = { storageRoot: v.storageRoot, smtp: { host: v.host, port: v.port, user: v.user, from: v.from }, azureAd: { tenantId: v.tenantId, clientId: v.clientId, clientSecret: v.clientSecret }, branding: { logoUrl: v.logoUrl }, security: { csp: v.csp }, signing: { requireForCertification: !!v.signingRequire, defaultPfxPath: this.pfxPath } }; this.http.put(`/api/config/`, dto).subscribe({ next: _=> this.toast.show('Guardado','success',1500), error: _=> this.toast.show('Error al guardar','error',2000) }); }
  onPfx(f: File | null){ this.pfxFile = f; }
  uploadPfx(){ if (!this.pfxFile) return; const fd = new FormData(); fd.append('file', this.pfxFile); fd.append('password', this.form.value.pfxPassword || ''); fd.append('alias', this.form.value.signingAlias || 'default'); this.http.post<any>(`/api/signing/profiles`, fd).subscribe({ next: _=> { this.toast.show('Perfil cargado','success',1500); this.loadProfiles(); }, error: _=> this.toast.show('Error al cargar perfil','error',2000) }); }
  deleteProfile(alias: string){ if(!confirm(`Eliminar perfil ${alias}?`)) return; this.http.delete(`/api/signing/profiles/${alias}`).subscribe({ next: _=> { this.toast.show('Perfil eliminado','success',1500); this.loadProfiles(); }, error: err=> this.toast.show(err?.error?.error==='profile_in_use'?'Perfil en uso por una elección':'No se pudo eliminar','error',2000) }); }
  setCsp(k: 'default'|'script'|'style'|'img'|'connect'|'frames', v: string){ (this.cspForm as any)[k] = v; this.buildCspString(); }
  applyPreset(type: 'strict'|'default'|'dev'){
    if (type==='strict') this.cspForm = { default: "'self'", script: "'self'", style: "'self'", img: "'self'", connect: "'self'", frames: "'none'" } as any;
    if (type==='default') this.cspForm = { default: "'self'", script: "'self' 'unsafe-inline'", style: "'self' 'unsafe-inline'", img: "'self' data:", connect: "'self'", frames: "'none'" } as any;
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

