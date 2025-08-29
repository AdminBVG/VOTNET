import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface PadronRow { id:string; shareholderId:string; shareholderName:string; shares:number; attendance:string }

@Component({
  selector: 'app-attendance-register',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, MatTableModule, MatButtonModule, MatSelectModule, MatCheckboxModule, MatSnackBarModule],
  template: `
  <div class="page">
    <h2>Registro de asistencia</h2>
    <div class="toolbar">
      <mat-select [(value)]="bulkStatus" class="status">
        <mat-option value="Presencial">Presencial</mat-option>
        <mat-option value="Virtual">Virtual</mat-option>
        <mat-option value="None">Ausente</mat-option>
      </mat-select>
      <button mat-stroked-button (click)="markAll()">Marcar todo</button>
      <button mat-raised-button color="primary" (click)="markSelected()" [disabled]="!anySelected()">Marcar seleccionados</button>
    </div>
    <div class="summary" *ngIf="rows().length">
      Total: {{total()}} · Presenciales: {{count('Presencial')}} · Virtuales: {{count('Virtual')}} · Ausentes: {{count('None')}}
      <div class="bar"><div class="p" [style.width.%]="presentPct()"></div></div>
    </div>
    <table mat-table [dataSource]="rows()" class="mat-elevation-z1 compact" *ngIf="rows().length">
      <ng-container matColumnDef="sel"><th mat-header-cell *matHeaderCellDef></th><td mat-cell *matCellDef="let r"><mat-checkbox [(ngModel)]="selected[r.id]"></mat-checkbox></td></ng-container>
      <ng-container matColumnDef="id"><th mat-header-cell *matHeaderCellDef>ID</th><td mat-cell *matCellDef="let r">{{r.shareholderId}}</td></ng-container>
      <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>Accionista</th><td mat-cell *matCellDef="let r">{{r.shareholderName}}</td></ng-container>
      <ng-container matColumnDef="att"><th mat-header-cell *matHeaderCellDef>Asistencia</th><td mat-cell *matCellDef="let r">
        <button mat-button [disabled]="r.attendance==='Presencial'" (click)="set(r,'Presencial')">Presencial</button>
        <button mat-button [disabled]="r.attendance==='Virtual'" (click)="set(r,'Virtual')">Virtual</button>
        <button mat-button [disabled]="r.attendance==='None'" (click)="set(r,'None')">Ausente</button>
      </td></ng-container>
      <tr mat-header-row *matHeaderRowDef="cols"></tr>
      <tr mat-row *matRowDef="let row; columns: cols;"></tr>
    </table>
    <div *ngIf="!rows().length" class="muted">Sin padrón o sin permisos.</div>
  </div>
  `,
  styles: [`
    .page{ padding:16px }
    .toolbar{ display:flex; gap:8px; align-items:center; margin-bottom:8px }
    .status{ width: 160px }
    .summary{ margin: 8px 0 4px; font-size:13px; opacity:.9 }
    .bar{ height:6px; border-radius:4px; background:#eee; overflow:hidden; margin-top:4px; max-width:320px }
    .bar .p{ height:100%; background: var(--bvg-blue) }
    table.compact th, table.compact td{ font-size:13px }
    .muted{ opacity:.75 }
  `]
})
export class AttendanceRegisterComponent{
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private snack = inject(MatSnackBar);
  id = this.route.snapshot.params['id'];
  cols = ['sel','id','name','att'];
  rows = signal<PadronRow[]>([]);
  bulkStatus: 'Presencial'|'Virtual'|'None' = 'Presencial';
  selected: Record<string, boolean> = {};
  constructor(){ this.load(); }
  load(){ this.http.get<PadronRow[]>(`/api/elections/${this.id}/padron`).subscribe({ next: d=> { this.rows.set(d||[]); this.selected = {}; }, error: _=> this.rows.set([]) }); }
  set(r: PadronRow, att: 'Presencial'|'Virtual'|'None'){
    this.http.post(`/api/elections/${this.id}/padron/${r.id}/attendance`, { attendance: att }).subscribe({ next: _=> { r.attendance = att; this.snack.open('Actualizado','OK',{duration:1000}); }, error: _=> this.snack.open('Error','OK',{duration:1500}) });
  }
  anySelected(){ return Object.values(this.selected).some(v=>v); }
  markAll(){ if(!confirm(`Aplicar "${this.bulkStatus}" a todos?`)) return; this.http.post(`/api/elections/${this.id}/attendance/batch`, { attendance: this.bulkStatus }).subscribe({ next: _=> { this.snack.open('Marcado masivo aplicado','OK',{duration:1200}); this.load(); }, error: _=> this.snack.open('Error','OK',{duration:1500}) }); }
  markSelected(){ const ids = Object.keys(this.selected).filter(k=>this.selected[k]); if(!ids.length) return; if(!confirm(`Aplicar "${this.bulkStatus}" a ${ids.length} seleccionados?`)) return; this.http.post(`/api/elections/${this.id}/attendance/batch`, { attendance: this.bulkStatus, ids }).subscribe({ next: _=> { this.snack.open('Seleccionados actualizados','OK',{duration:1200}); this.load(); }, error: _=> this.snack.open('Error','OK',{duration:1500}) }); }
  total(){ return this.rows().length; }
  count(att: 'Presencial'|'Virtual'|'None'){ return this.rows().filter(r=>r.attendance===att).length; }
  presentPct(){ const t=this.total(); if(!t) return 0; return Math.round(this.count('Presencial')/t*100); }
}
