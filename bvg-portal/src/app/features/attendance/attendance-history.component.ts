import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NgIf, NgFor, DatePipe } from '@angular/common';

interface LogRow { padronEntryId:string; oldAttendance:string; newAttendance:string; userId:string; userName?:string; timestamp:string }

@Component({
  selector: 'app-attendance-history',
  standalone: true,
  imports: [NgIf, NgFor, DatePipe],
  template: `
  <div class="p-4">
    <h2 class="text-xl font-semibold mb-2">Historial de asistencia</h2>
    <table class="w-full text-sm border border-gray-200 rounded-xl overflow-hidden" *ngIf="rows().length">
      <thead class="bg-gray-50 text-gray-600">
        <tr>
          <th class="text-left p-2">Fecha</th>
          <th class="text-left p-2">PadronId</th>
          <th class="text-left p-2">Usuario</th>
          <th class="text-left p-2">Cambio</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let r of rows()" class="border-t">
          <td class="p-2">{{r.timestamp | date:'medium'}}</td>
          <td class="p-2">{{r.padronEntryId}}</td>
          <td class="p-2">{{r.userName || r.userId}}</td>
          <td class="p-2">{{r.oldAttendance}} → {{r.newAttendance}}</td>
        </tr>
      </tbody>
    </table>
    <div *ngIf="!rows().length" class="opacity-75">Sin datos o sin permisos.</div>
  </div>
  `,
  styles: []
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

