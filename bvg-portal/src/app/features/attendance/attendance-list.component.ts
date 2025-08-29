import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

interface AssignedDto { id: string; name: string; scheduledAt: string; isClosed: boolean; }

@Component({
  selector: 'app-attendance-list',
  standalone: true,
  imports: [NgIf, NgFor, DatePipe, MatCardModule, MatButtonModule],
  template: `
  <div class="page">
    <h2>Mis elecciones asignadas</h2>
    <div *ngIf="!items().length" class="muted">No tienes elecciones asignadas.</div>
    <div class="grid">
      <mat-card *ngFor="let e of items()" class="mat-elevation-z1">
        <h3>{{e.name}}</h3>
        <div class="meta">{{e.scheduledAt | date:'medium'}} <span *ngIf="e.isClosed" class="chip">Cerrada</span></div>
        <div class="actions">
          <button mat-stroked-button color="primary" (click)="goReq(e.id)">Requisitos</button>
          <button mat-raised-button color="primary" (click)="goReg(e.id)" [disabled]="e.isClosed">Comenzar registro</button>
        </div>
      </mat-card>
    </div>
  </div>
  `,
  styles: [`
    .page{ padding:16px }
    .grid{ display:grid; grid-template-columns: repeat(auto-fit, minmax(260px,1fr)); gap:12px }
    .actions{ display:flex; gap:8px; margin-top:8px }
    .meta{ opacity:.85; font-size:13px }
    .chip{ background:#eee; border-radius:12px; padding:2px 8px; font-size:12px; margin-left:6px }
    .muted{ opacity:.75 }
  `]
})
export class AttendanceListComponent {
  private http = inject(HttpClient);
  private router = inject(Router);
  items = signal<AssignedDto[]>([]);
  constructor(){ this.load(); }
  load(){ this.http.get<AssignedDto[]>(`/api/elections/assigned?role=ElectionRegistrar`).subscribe({ next: d=> this.items.set(d||[]), error: _=> this.items.set([]) }); }
  goReq(id: string){ this.router.navigate(['/attendance', id, 'requirements']); }
  goReg(id: string){ this.router.navigate(['/attendance', id, 'register']); }
}

