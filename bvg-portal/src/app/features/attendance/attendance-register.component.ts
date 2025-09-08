import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LiveService } from '../../core/live.service';
import { NgIf, NgFor, NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiButtonDirective } from '../../ui/button.directive';
import { UiInputDirective } from '../../ui/input.directive';
import { UiSwitchComponent } from '../../ui/switch.component';
import { ToastService } from '../../ui/toast/toast.service';
import { AuthService } from '../../core/auth.service';

interface PadronRow {
  id: string;
  shareholderId: string;
  shareholderName: string;
  legalRepresentative?: string;
  proxy?: string;
  shares: number;
  attendance: string;
  hasActa?: boolean;
}

@Component({
  selector: 'app-attendance-register',
  standalone: true,
  imports: [NgIf, NgFor, NgStyle, FormsModule, UiButtonDirective, UiInputDirective, UiSwitchComponent],
  template: `
  <div class="p-4">
    <h2 class="text-xl font-semibold mb-2">Registro de asistencia</h2>
    <div class="state flex items-center gap-2 mb-2">Estado: <strong>{{ locked ? 'Cerrada' : 'Abierta' }}</strong>
      <button uiBtn="secondary" *ngIf="auth.hasRole('GlobalAdmin') || auth.hasRole('VoteAdmin')" (click)="toggleLock()">{{ locked ? 'Abrir asistencia' : 'Cerrar asistencia' }}</button>
      <button uiBtn="secondary" *ngIf="(auth.hasRole('GlobalAdmin') || auth.hasRole('VoteAdmin')) && status==='Draft'" (click)="openRegistration()">Abrir registro</button>
      <button uiBtn="secondary" *ngIf="(auth.hasRole('GlobalAdmin') || auth.hasRole('VoteAdmin')) && status==='RegistrationClosed'" (click)="reopenRegistration()">Reabrir registro</button>
    </div>

    <div class="charts my-2" *ngIf="rows().length">
      <div class="donut" [ngStyle]="chartStyle()">
        <div class="hole">
          <div class="center">
            <div class="num">{{presentCount()+virtualCount()}}</div>
            <div class="sub">Presentes</div>
            <div class="num shares">{{presentShares()+virtualShares()}}</div>
            <div class="sub">Acciones</div>
          </div>
        </div>
      </div>
      <div class="legend">
        <span class="item"><span class="box presencial"></span> Presencial: {{presentCount()}} personas / {{presentShares()}} acciones</span>
        <span class="item"><span class="box virtual"></span> Virtual: {{virtualCount()}} personas / {{virtualShares()}} acciones</span>
        <span class="item"><span class="box ausente"></span> Ausente: {{absentCount()}} personas / {{absentShares()}} acciones</span>
      </div>
    </div>

    <div class="toolbar flex items-center gap-2 my-2">
      <select uiInput [(ngModel)]="bulkStatus" class="status w-52">
        <option value="Presencial">Presencial</option>
        <option value="Virtual">Virtual</option>
        <option value="None">Ausente</option>
      </select>
      <button uiBtn="secondary" (click)="markAll()" [disabled]="!canMark" title="{{!canMark ? 'Registro no estÃ¡ abierto o asistencia bloqueada' : ''}}">Marcar todo</button>
      <button uiBtn="primary" (click)="markSelected()" [disabled]="!canMark || !anySelected()" title="{{!canMark ? 'Registro no estÃ¡ abierto o asistencia bloqueada' : (!anySelected() ? 'Seleccione al menos un registro' : '')}}">Marcar seleccionados</button>
    </div>

    <div class="summary text-sm my-2" *ngIf="rows().length">
      Total: {{total()}} Â· Presenciales: {{count('Presencial')}} Â· Virtuales: {{count('Virtual')}} Â· Ausentes: {{count('None')}}
      <div class="bar"><div class="p" [style.width.%]="presentPct()"></div></div>
    </div>

    <table class="w-full text-sm border border-gray-200 rounded-xl overflow-hidden compact" *ngIf="rows().length">
      <thead>
        <tr>
          <th class="p-2"></th>
          <th class="text-left p-2">ID</th>
          <th class="text-left p-2">Accionista</th>
          <th class="text-left p-2">Representante</th>
          <th class="text-left p-2">Apoderado</th>
          <th class="text-left p-2">Asistencia</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let r of rows()" class="border-t">
          <td class="p-2"><input type="checkbox" [(ngModel)]="selected[r.id]"></td>
          <td class="p-2">{{r.shareholderId}}</td>
          <td class="p-2">{{r.shareholderName}}</td>
          <td class="p-2">{{ r.legalRepresentative || '-' }}</td>
          <td class="p-2">
            <a *ngIf="r.proxy && r.hasActa" (click)="view(r)" class="link">{{ r.proxy }}</a>
            <span *ngIf="r.proxy && !r.hasActa">{{ r.proxy }} <span class="muted">(sin acta)</span></span>
            <span *ngIf="!r.proxy" class="muted">-</span>
          </td>
          <td class="p-2">
            <select uiInput [disabled]="locked" [ngModel]="r.attendance" (ngModelChange)="set(r,$event)">
              <option value="Presencial">Presencial</option>
              <option value="Virtual">Virtual</option>
              <option value="None">Ausente</option>
            </select>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  `,
  styles: [`
    .donut{ width:180px; height:180px; border-radius:50%; position:relative; box-shadow: inset 0 0 0 10px #fff; display:inline-block }
    .hole{ position:absolute; inset:15px; background:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center }
    .center{ text-align:center }
    .num{ font-weight:700; font-size:20px }
    .num.shares{ font-size:16px }
    .sub{ font-size:12px; opacity:.75 }
    .legend{ display:flex; gap:12px; flex-wrap:wrap; margin-top:8px }
    .legend .box{ display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:6px; vertical-align:middle }
    .legend .presencial{ background:#2e7d32 }
    .legend .virtual{ background:#1565c0 }
    .legend .ausente{ background:#9e9e9e }
    .bar{ height:8px; background:#eee; border-radius:6px; overflow:hidden; margin-top:4px }
    .bar .p{ height:100%; background:#2e7d32 }
    .compact th, .compact td{ font-size:13px }
    .link{ color: var(--bvg-blue); cursor:pointer; text-decoration:underline }
    .muted{ opacity:.75 }
  `]
})
export class AttendanceRegisterComponent{
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private live = inject(LiveService);
  private toast = inject(ToastService);
  auth = inject(AuthService);
  locked = false;
  status: 'Draft'|'RegistrationOpen'|'RegistrationClosed'|'VotingOpen'|'VotingClosed'|'Certified'|string = 'Draft';
  canMark = false;
  id = this.route.snapshot.params['id'];
  rows = signal<PadronRow[]>([]);
  bulkStatus: 'Presencial'|'Virtual'|'None' = 'Presencial';
  selected: Record<string, boolean> = {};
  constructor(){
    this.load();
    this.live.joinElection(this.id);
    this.http.get<any>(`/api/elections/${this.id}/attendance/summary`).subscribe({ next: d=> { this.locked = !!d?.locked; this.canMark = (this.status === 'RegistrationOpen') && !this.locked; }, error: _=>{} });
    this.http.get<any>(`/api/elections/${this.id}/status`).subscribe({ next: s=> { const stat = (s?.Status ?? s?.status ?? 'Draft'); const lck = !!(s?.Locked ?? s?.locked ?? false); this.status = stat; this.locked = lck; this.canMark = (stat === 'RegistrationOpen') && !lck; }, error: _=>{} });
    this.live.onAttendanceUpdated(p => {
      if (p && p.ElectionId === this.id){
        const r = this.rows().find(x => x.id === p.PadronId);
        if (r) r.attendance = p.Attendance as any;
      }
    });
    this.live.onAttendanceSummary(_ => {/* donut recalculates from rows; no-op */});
    this.live.onAttendanceLockChanged(p => { if (p && p.ElectionId === this.id) { this.locked = p.Locked; this.canMark = (this.status === 'RegistrationOpen') && !this.locked; } });
  }
  load(){
    this.http.get<PadronRow[]>(`/api/elections/${this.id}/padron`).subscribe({
      next: d=> {
        const sortedData = (d || []).sort((a, b) => {
          const aNum = parseInt(a.shareholderId) || 0;
          const bNum = parseInt(b.shareholderId) || 0;
          return aNum - bNum;
        });
        this.rows.set(sortedData);
        this.selected = {};
      },
      error: _=> this.rows.set([])
    });
  }
  view(r: PadronRow){
    this.http.get(`/api/elections/${this.id}/padron/${r.id}/acta`, { responseType: 'blob' as 'json' }).subscribe({
      next: (data:any) => {
        const blob = data as Blob; const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(()=> URL.revokeObjectURL(url), 15000);
      },
      error: _ => this.toast.show('No se pudo abrir el PDF','error',2000)
    });
  }
  presentCount(){ return this.rows().filter(r=>r.attendance==='Presencial').length; }
  virtualCount(){ return this.rows().filter(r=>r.attendance==='Virtual').length; }
  absentCount(){ return this.rows().filter(r=>r.attendance==='None').length; }
  presentShares(){ return this.rows().filter(r=>r.attendance==='Presencial').reduce((s,r)=>s+r.shares,0); }
  virtualShares(){ return this.rows().filter(r=>r.attendance==='Virtual').reduce((s,r)=>s+r.shares,0); }
  absentShares(){ return this.rows().filter(r=>r.attendance==='None').reduce((s,r)=>s+r.shares,0); }
  chartStyle(){
    const total = this.rows().length || 1;
    const p = Math.round(this.presentCount()/total*100);
    const v = Math.round(this.virtualCount()/total*100);
    const a = 100 - p - v;
    const g = `conic-gradient(#2e7d32 0 ${p}%, #1565c0 ${p}% ${p+v}%, #9e9e9e ${p+v}% 100%)`;
    return { background: g } as any;
  }
  set(r: PadronRow, att: 'Presencial'|'Virtual'|'None'){
    if (!this.canMark) { this.toast.show('Registro no estÃ¡ abierto o asistencia bloqueada','warning',1800); return; }
    this.http.post(`/api/elections/${this.id}/padron/${r.id}/attendance`, { attendance: att === 'Presencial' ? 2 : (att === 'Virtual' ? 1 : 0) }).subscribe({
      next: _=> { r.attendance = att; this.toast.show('Asistencia actualizada','success',1300); },
      error: err => this.toast.show(this.mapAttendanceError(err), 'error', 2200)
    });
  }
  anySelected(){ return Object.values(this.selected).some(v=>v); }
  markAll(){
    if (!this.canMark) { this.toast.show('Registro no estÃ¡ abierto o asistencia bloqueada','warning',1800); return; }
    if(!confirm(`Aplicar "${this.bulkStatus}" a todos?`)) return;
    this.http.post(`/api/elections/${this.id}/attendance/batch`, { attendance: this.bulkStatus, reason: 'MarcaciÃ³n global' }).subscribe({
      next: _=> { this.toast.show('Marcado masivo aplicado','success',1200); this.load(); },
      error: err => this.toast.show(this.mapAttendanceError(err), 'error', 2200)
    });
  }
  markSelected(){
    if (!this.canMark) { this.toast.show('Registro no estÃ¡ abierto o asistencia bloqueada','warning',1800); return; }
    const ids = Object.keys(this.selected).filter(k=>this.selected[k]); if(!ids.length) return;
    if(!confirm(`Aplicar "${this.bulkStatus}" a ${ids.length} seleccionados?`)) return;
    this.http.post(`/api/elections/${this.id}/attendance/batch`, { attendance: this.bulkStatus, ids, reason: 'MarcaciÃ³n pÃ¡gina' }).subscribe({
      next: _=> { this.toast.show('Seleccionados actualizados','success',1200); this.load(); },
      error: err => this.toast.show(this.mapAttendanceError(err), 'error', 2200)
    });
  }
  toggleLock(){
    const isAdmin = this.auth.hasRole('GlobalAdmin') || this.auth.hasRole('VoteAdmin');
    if (!isAdmin) return;
    const url = this.locked ? `/api/elections/${this.id}/attendance/unlock` : `/api/elections/${this.id}/attendance/lock`;
    this.http.post(url, {}).subscribe({ next: (res:any)=> { this.locked = !!(res?.locked ?? !this.locked); this.toast.show(this.locked ? 'Asistencia cerrada' : 'Asistencia abierta','success',1500); }, error: _=> this.toast.show('Error','error',1500) });
  }
  total(){ return this.rows().length; }
  count(att: 'Presencial'|'Virtual'|'None'){ return this.rows().filter(r=>r.attendance===att).length; }
  presentPct(){ const t=this.total(); if(!t) return 0; return Math.round(this.count('Presencial')/t*100); }
  private mapAttendanceError(err: any): string {
    const code = (err && err.error && err.error.error) ? String(err.error.error) : '';
    switch (code) {
      case 'attendance_closed': return 'La asistencia estÃ¡ cerrada para esta elecciÃ³n.';
      case 'forbidden': return 'No tienes permisos para registrar asistencia en esta elecciÃ³n.';
      case 'padron_entry_not_found': return 'No se encontrÃ³ el registro del padrÃ³n.';
      default:
        if (err && err.status === 0) return 'No hay conexiÃ³n con el servidor.';
        if (err && err.status === 400) return 'Solicitud invÃ¡lida.';
        if (err && err.status === 403) return 'Acceso denegado.';
        return 'OcurriÃ³ un error al actualizar la asistencia.';
    }
  }
  openRegistration(){
    const isAdmin = this.auth.hasRole('GlobalAdmin') || this.auth.hasRole('VoteAdmin');
    if (!isAdmin) return;
    this.http.post('/api/elections/' + this.id + '/status/open-registration', {})
      .subscribe({
        next: _ => { this.status = 'RegistrationOpen'; this.locked = false; this.canMark = true; this.toast.show('Registro abierto','success',1500); },
        error: _ => this.toast.show('No se pudo abrir registro','error',2000)
      });
  }
  ngOnDestroy(){ this.live.leaveElection(this.id); }
  reopenRegistration(){
    const isAdmin = this.auth.hasRole('GlobalAdmin') || this.auth.hasRole('VoteAdmin');
    if (!isAdmin) return;
    this.http.post('/api/elections/' + this.id + '/status/reopen-registration', { confirm: true })
      .subscribe({
        next: _ => { this.status = 'RegistrationOpen'; this.locked = false; this.canMark = true; this.toast.show('Registro reabierto','success',1500); },
        error: _ => this.toast.show('No se pudo reabrir registro','error',2000)
      });
  }
}



