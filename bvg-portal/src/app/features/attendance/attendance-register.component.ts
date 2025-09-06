import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LiveService } from '../../core/live.service';
import { NgIf, NgFor, NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
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
  imports: [NgIf, NgFor, NgStyle, FormsModule, MatTableModule, MatButtonModule, MatSelectModule, MatCheckboxModule, MatSnackBarModule, MatTooltipModule],
  template: `
  <div class="page">
    <h2>Registro de asistencia</h2>
    <div class="state">Estado: <strong>{{ locked ? \u0027Cerrada\u0027 : \u0027Abierta\u0027 }}</strong>
      <button *ngIf="auth.hasRole(\u0027GlobalAdmin\u0027) || auth.hasRole(\u0027VoteAdmin\u0027)" mat-stroked-button color="primary" (click)="toggleLock()">{{ locked ? \u0027Abrir asistencia\u0027 : \u0027Cerrar asistencia\u0027 }}</button>
      <button *ngIf="(auth.hasRole(\u0027GlobalAdmin\u0027) || auth.hasRole(\u0027VoteAdmin\u0027)) && status===\u0027Draft\u0027" mat-stroked-button color="primary" (click)="openRegistration()">Abrir registro</button>
      <button *ngIf="(auth.hasRole(\u0027GlobalAdmin\u0027) || auth.hasRole(\u0027VoteAdmin\u0027)) && status===\u0027RegistrationClosed\u0027" mat-stroked-button color="primary" (click)="reopenRegistration()">Reabrir registro</button>
    </div>
    <div class="charts" *ngIf="rows().length">
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
    <div class="toolbar">
      <mat-select [(value)]="bulkStatus" class="status">
        <mat-option value="Presencial">Presencial</mat-option>
        <mat-option value="Virtual">Virtual</mat-option>
        <mat-option value="None">Ausente</mat-option>
      </mat-select>
      <button mat-stroked-button (click)="markAll()" [disabled]="!canMark" [matTooltip]="!canMark ? 'Registro no estÃ¡ abierto o asistencia bloqueada' : ''">Marcar todo</button>
      <button mat-raised-button color="primary" (click)="markSelected()" [disabled]="!canMark || !anySelected()" [matTooltip]="!canMark ? 'Registro no estÃ¡ abierto o asistencia bloqueada' : (!anySelected() ? 'Seleccione al menos un registro' : '')">Marcar seleccionados</button>
    </div>
    <div class="summary" *ngIf="rows().length">
      Total: {{total()}} Â· Presenciales: {{count('Presencial')}} Â· Virtuales: {{count('Virtual')}} Â· Ausentes: {{count('None')}}
      <div class="bar"><div class="p" [style.width.%]="presentPct()"></div></div>
    </div>
    <table mat-table [dataSource]="rows()" class="mat-elevation-z1 compact" *ngIf="rows().length">
      <ng-container matColumnDef="sel">
        <th mat-header-cell *matHeaderCellDef></th>
        <td mat-cell *matCellDef="let r"><mat-checkbox [(ngModel)]="selected[r.id]"></mat-checkbox></td>
      </ng-container>
      <ng-container matColumnDef="id">
        <th mat-header-cell *matHeaderCellDef>ID</th>
        <td mat-cell *matCellDef="let r">{{r.shareholderId}}</td>
      </ng-container>
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef>Accionista</th>
        <td mat-cell *matCellDef="let r">{{r.shareholderName}}</td>
      </ng-container>
      <ng-container matColumnDef="legal">
        <th mat-header-cell *matHeaderCellDef>Representante</th>
        <td mat-cell *matCellDef="let r">{{ r.legalRepresentative || '-' }}</td>
      </ng-container>
      <ng-container matColumnDef="proxy">
        <th mat-header-cell *matHeaderCellDef>Apoderado</th>
        <td mat-cell *matCellDef="let r">
          <a *ngIf="r.proxy && r.hasActa" (click)="view(r)" class="link">{{ r.proxy }}</a>
          <span *ngIf="r.proxy && !r.hasActa">{{ r.proxy }}</span>
          <span *ngIf="!r.proxy">-</span>
        </td>
      </ng-container>
      <ng-container matColumnDef="att">
        <th mat-header-cell *matHeaderCellDef>Asistencia</th>
        <td mat-cell *matCellDef="let r">
          <mat-select [value]="r.attendance" (selectionChange)="set(r,$event.value)" [disabled]="locked">
            <mat-option value="Presencial">Presencial</mat-option>
            <mat-option value="Virtual">Virtual</mat-option>
            <mat-option value="None">Ausente</mat-option>
          </mat-select>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="cols"></tr>
      <tr mat-row *matRowDef="let row; columns: cols;"></tr>
    </table>
    <div *ngIf="!rows().length" class="muted">Sin padrÃ³n o sin permisos.</div>
  </div>
  `,
  styles: [`
    .page{ padding:16px }
    .charts{ display:flex; align-items:center; gap:16px; margin-bottom:8px }
    .donut{ width:140px; height:140px; border-radius:50%; position:relative; background:#eee }
    .donut .hole{ position:absolute; inset:18px; background:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center }
    .donut .center{ text-align:center; line-height:1 }
    .donut .num{ font-size:20px; font-weight:600 }
    .donut .num.shares{ font-size:14px; margin-top:4px }
    .donut .sub{ font-size:11px; opacity:.75 }
    .legend{ display:flex; gap:12px; flex-wrap:wrap; font-size:13px; opacity:.95 }
    .legend .box{ display:inline-block; width:12px; height:12px; border-radius:3px; margin-right:6px }
    .legend .presencial{ background:#2e7d32 }
    .legend .virtual{ background:#1565c0 }
    .legend .ausente{ background:#9e9e9e }
    .toolbar{ display:flex; gap:8px; align-items:center; margin-bottom:8px }
    .status{ width: 160px }
    .summary{ margin: 8px 0 4px; font-size:13px; opacity:.9 }
    .bar{ height:6px; border-radius:4px; background:#eee; overflow:hidden; margin-top:4px; max-width:320px }
    .bar .p{ height:100%; background: var(--bvg-blue) }
    table.compact th, table.compact td{ font-size:13px }
    .link{ color: var(--bvg-blue); cursor:pointer; text-decoration:underline }
    .muted{ opacity:.75 }
  `]
})
export class AttendanceRegisterComponent{
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private live = inject(LiveService);
  private snack = inject(MatSnackBar);
  auth = inject(AuthService);
  locked = false;
  status: 'Draft'|'RegistrationOpen'|'RegistrationClosed'|'VotingOpen'|'VotingClosed'|'Certified'|string = 'Draft';
  canMark = false;
  id = this.route.snapshot.params['id'];
  cols = ['sel','id','name','legal','proxy','att'];
  rows = signal<PadronRow[]>([]);
  bulkStatus: 'Presencial'|'Virtual'|'None' = 'Presencial';
  selected: Record<string, boolean> = {};
  constructor(){
    this.load();
    // Load summary to know lock state
    this.http.get<any>(`/api/elections/${this.id}/attendance/summary`).subscribe({ next: d=> { this.locked = !!d?.locked; this.canMark = (this.status === 'RegistrationOpen') && !this.locked; }, error: _=>{} });
    this.http.get<any>(`/api/elections/${this.id}/status`).subscribe({ next: s=> { const stat = (s?.Status ?? s?.status ?? 'Draft'); const lck = !!(s?.Locked ?? s?.locked ?? false); this.status = stat; this.locked = lck; this.canMark = (stat === 'RegistrationOpen') && !lck; }, error: _=>{} });
    // Live updates for attendance
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
        // Ordenar por ID de accionista numÃ©ricamente
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
      error: _ => this.snack.open('No se pudo abrir el PDF','OK',{duration:2000})
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
    if (!this.canMark) { this.snack.open('Registro no estÃ¡ abierto o asistencia bloqueada','OK',{duration:1800}); return; }
    this.http.post(`/api/elections/${this.id}/padron/${r.id}/attendance`, { attendance: att === 'Presencial' ? 2 : (att === 'Virtual' ? 1 : 0) }).subscribe({
      next: _=> { r.attendance = att; this.snack.open('Asistencia actualizada','OK',{duration:1300}); },
      error: err => this.snack.open(this.mapAttendanceError(err), 'OK', { duration: 2200 })
    });
  }
  anySelected(){ return Object.values(this.selected).some(v=>v); }
  markAll(){
    if (!this.canMark) { this.snack.open('Registro no estÃ¡ abierto o asistencia bloqueada','OK',{duration:1800}); return; }
    if(!confirm(`Aplicar "${this.bulkStatus}" a todos?`)) return;
    this.http.post(`/api/elections/${this.id}/attendance/batch`, { attendance: this.bulkStatus, reason: 'Marcación global' }).subscribe({
      next: _=> { this.snack.open('Marcado masivo aplicado','OK',{duration:1200}); this.load(); },
      error: err => this.snack.open(this.mapAttendanceError(err), 'OK', { duration: 2200 })
    });
  }
  markSelected(){
    if (!this.canMark) { this.snack.open('Registro no estÃ¡ abierto o asistencia bloqueada','OK',{duration:1800}); return; }
    const ids = Object.keys(this.selected).filter(k=>this.selected[k]); if(!ids.length) return;
    if(!confirm(`Aplicar "${this.bulkStatus}" a ${ids.length} seleccionados?`)) return;
    this.http.post(`/api/elections/${this.id}/attendance/batch`, { attendance: this.bulkStatus, ids, reason: 'Marcación pÃ¡gina' }).subscribe({
      next: _=> { this.snack.open('Seleccionados actualizados','OK',{duration:1200}); this.load(); },
      error: err => this.snack.open(this.mapAttendanceError(err), 'OK', { duration: 2200 })
    });
  }
  toggleLock(){
    const isAdmin = this.auth.hasRole('GlobalAdmin') || this.auth.hasRole('VoteAdmin');
    if (!isAdmin) return;
    const url = this.locked ? `/api/elections/${this.id}/attendance/unlock` : `/api/elections/${this.id}/attendance/lock`;
    this.http.post(url, {}).subscribe({ next: (res:any)=> { this.locked = !!(res?.locked ?? !this.locked); this.snack.open(this.locked ? 'Asistencia cerrada' : 'Asistencia abierta','OK',{duration:1500}); }, error: _=> this.snack.open('Error','OK',{duration:1500}) });
  }
  total(){ return this.rows().length; }
  count(att: 'Presencial'|'Virtual'|'None'){ return this.rows().filter(r=>r.attendance===att).length; }
  presentPct(){ const t=this.total(); if(!t) return 0; return Math.round(this.count('Presencial')/t*100); }
  private mapAttendanceError(err: any): string {
    const code = (err && err.error && err.error.error) ? String(err.error.error) : '';
    switch (code) {
      case 'attendance_closed': return 'La asistencia está cerrada para esta elección.';
      case 'forbidden': return 'No tienes permisos para registrar asistencia en esta elecciÃ³n.';
      case 'padron_entry_not_found': return 'No se encontró el registro del padrón.';
      default:
        if (err && err.status === 0) return 'No hay conexión con el servidor.';
        if (err && err.status === 400) return 'Solicitud inválida.';
        if (err && err.status === 403) return 'Acceso denegado.';
        return 'Ocurrió un error al actualizar la asistencia.';
    }
  }
  openRegistration(){
    const isAdmin = this.auth.hasRole('GlobalAdmin') || this.auth.hasRole('VoteAdmin');
    if (!isAdmin) return;
    this.http.post('/api/elections/' + this.id + '/status/open-registration', {})
      .subscribe({
        next: _ => { this.status = 'RegistrationOpen'; this.locked = false; this.canMark = true; this.snack.open('Registro abierto','OK',{duration:1500}); },
        error: _ => this.snack.open('No se pudo abrir registro','OK',{duration:2000})
      });
  }

  reopenRegistration(){
    const isAdmin = this.auth.hasRole('GlobalAdmin') || this.auth.hasRole('VoteAdmin');
    if (!isAdmin) return;
    this.http.post('/api/elections/' + this.id + '/status/reopen-registration', { confirm: true })
      .subscribe({
        next: _ => { this.status = 'RegistrationOpen'; this.locked = false; this.canMark = true; this.snack.open('Registro reabierto','OK',{duration:1500}); },
        error: _ => this.snack.open('No se pudo reabrir registro','OK',{duration:2000})
      });
  }
}