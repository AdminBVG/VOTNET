import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';

interface LogRow { padronEntryId:string; oldAttendance:string; newAttendance:string; userId:string; userName?:string; timestamp:string }

@Component({
  selector: 'app-attendance-history',
  standalone: true,
  imports: [NgIf, NgFor, DatePipe, MatTableModule],
  template: `
  <div class="page">
    <h2>Historial de asistencia</h2>
    <table mat-table [dataSource]="rows()" class="mat-elevation-z1 compact" *ngIf="rows().length">
      <ng-container matColumnDef="ts"><th mat-header-cell *matHeaderCellDef>Fecha</th><td mat-cell *matCellDef="let r">{{r.timestamp | date:'medium'}}</td></ng-container>
      <ng-container matColumnDef="pid"><th mat-header-cell *matHeaderCellDef>PadronId</th><td mat-cell *matCellDef="let r">{{r.padronEntryId}}</td></ng-container>
      <ng-container matColumnDef="by"><th mat-header-cell *matHeaderCellDef>Usuario</th><td mat-cell *matCellDef="let r">{{r.userName || r.userId}}</td></ng-container>
      <ng-container matColumnDef="chg"><th mat-header-cell *matHeaderCellDef>Cambio</th><td mat-cell *matCellDef="let r">{{r.oldAttendance}} → {{r.newAttendance}}</td></ng-container>
      <tr mat-header-row *matHeaderRowDef="cols"></tr>
      <tr mat-row *matRowDef="let row; columns: cols;"></tr>
    </table>
    <div *ngIf="!rows().length" class="muted">Sin datos o sin permisos.</div>
  </div>
  `,
  styles: [`
    .page{ padding:16px }
    table.compact th, table.compact td{ font-size:13px }
    .muted{ opacity:.75 }
  `]
})
export class AttendanceHistoryComponent{
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  id = this.route.snapshot.params['id'];
  rows = signal<LogRow[]>([]);
  cols = ['ts','pid','by','chg'];
  constructor(){
    this.http.get<LogRow[]>(`/api/elections/${this.id}/attendance/logs?take=200`).subscribe({ next: d=> this.rows.set(d||[]), error: _=> this.rows.set([]) });
  }
}

