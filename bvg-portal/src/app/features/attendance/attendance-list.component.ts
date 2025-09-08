import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { UiIconComponent } from '../../ui/icon.component';
import { UiButtonDirective } from '../../ui/button.directive';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Roles } from '../../core/constants/roles';

interface AssignedDto { id: string; name: string; scheduledAt: string; isClosed: boolean; }

@Component({
  selector: 'app-attendance-list',
  standalone: true,
  imports: [NgIf, NgFor, DatePipe, UiButtonDirective, UiIconComponent],
  template: `
  <div class="p-4">
    <h2 class="text-xl font-semibold mb-2">Mis elecciones asignadas</h2>
    <div *ngIf="loading(); else content" class="opacity-75">
      <div class="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
        <div class="rounded-2xl border border-gray-200 bg-white shadow-card p-4">
          <div class="skeleton-line w-40 mb-2"></div>
          <div class="skeleton-line w-28 mb-2"></div>
          <div class="skeleton-line w-24"></div>
        </div>
      </div>
    </div>
    <ng-template #content>
    <div *ngIf="!items().length" class="rounded-2xl border border-gray-200 bg-white shadow-card p-10 text-center text-muted">
      <div class="flex justify-center mb-2"><ui-icon name="empty" [size]="48"></ui-icon></div>
      <div>No tienes elecciones asignadas.</div>
    </div>
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
    </ng-template>
  </div>
  `,
  styles: []
})
export class AttendanceListComponent {
  private http = inject(HttpClient);
  private router = inject(Router);
  private auth = inject(AuthService);
  items = signal<AssignedDto[]>([]);
  loading = signal(true);
  constructor(){ this.load(); }
  load(){
    const role = Roles.AttendanceRegistrar;
    this.http.get<AssignedDto[]>(`/api/elections/assigned?role=${role}`).subscribe({ next: d=> { this.items.set(d||[]); this.loading.set(false); }, error: _=> { this.items.set([]); this.loading.set(false); } });
  }
  goReq(id: string){ this.router.navigate(['/attendance', id, 'requirements']); }
  goReg(id: string){ this.router.navigate(['/attendance', id, 'register']); }
}


