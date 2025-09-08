import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { UiButtonDirective } from '../../ui/button.directive';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Roles } from '../../core/constants/roles';

interface AssignedDto { id: string; name: string; scheduledAt: string; isClosed: boolean; }

@Component({
  selector: 'app-attendance-list',
  standalone: true,
  imports: [NgIf, NgFor, DatePipe, UiButtonDirective],
  template: `
  <div class="p-4">
    <h2 class="text-xl font-semibold mb-2">Mis elecciones asignadas</h2>
    <div *ngIf="!items().length" class="opacity-75">No tienes elecciones asignadas.</div>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
      <div *ngFor="let e of items()" class="rounded-2xl border border-gray-200 bg-white shadow-card p-4">
        <h3 class="font-semibold">{{e.name}}</h3>
        <div class="opacity-85 text-sm">{{e.scheduledAt | date:'medium'}} <span *ngIf="e.isClosed" class="bg-gray-100 rounded-full px-2 py-0.5 text-xs ml-1">Cerrada</span></div>
        <div class="flex gap-2 mt-2">
          <button uiBtn="secondary" (click)="goReq(e.id)">Requisitos</button>
          <button uiBtn="primary" (click)="goReg(e.id)" [disabled]="e.isClosed">Comenzar registro</button>
        </div>
      </div>
    </div>
  </div>
  `,
  styles: []
})
export class AttendanceListComponent {
  private http = inject(HttpClient);
  private router = inject(Router);
  private auth = inject(AuthService);
  items = signal<AssignedDto[]>([]);
  constructor(){ this.load(); }
  load(){
    const role = Roles.AttendanceRegistrar;
    this.http.get<AssignedDto[]>(`/api/elections/assigned?role=${role}`).subscribe({ next: d=> this.items.set(d||[]), error: _=> this.items.set([]) });
  }
  goReq(id: string){ this.router.navigate(['/attendance', id, 'requirements']); }
  goReg(id: string){ this.router.navigate(['/attendance', id, 'register']); }
}

