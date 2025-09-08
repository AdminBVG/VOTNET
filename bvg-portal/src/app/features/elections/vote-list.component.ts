import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { UiButtonDirective } from '../../ui/button.directive';
import { ToastService } from '../../ui/toast/toast.service';
import { Roles } from '../../core/constants/roles';

interface AssignedDto { id: string; name: string; scheduledAt: string; isClosed: boolean; }

@Component({
  selector: 'app-vote-list',
  standalone: true,
  imports: [NgIf, NgFor, DatePipe, UiButtonDirective],
  template: `
  <div class="p-4">
    <h2 class="text-xl font-semibold mb-2">Elecciones asignadas</h2>
    <div *ngIf="!items().length" class="opacity-75">No tienes elecciones asignadas.</div>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
      <div *ngFor="let e of items()" class="rounded-2xl border border-gray-200 bg-white shadow-card p-4">
        <h3 class="font-semibold">{{e.name}}</h3>
        <div class="opacity-85 text-sm">{{e.scheduledAt | date:'medium'}} <span *ngIf="e.isClosed" class="bg-gray-100 rounded-full px-2 py-0.5 text-xs ml-1">Cerrada</span></div>
        <div class="flex gap-2 mt-2">
          <button uiBtn="primary" (click)="start(e.id)" [disabled]="e.isClosed">Empezar elecciÃ³n</button>
        </div>
      </div>
    </div>
  </div>
  `,
  styles: []
})
export class VoteListComponent {
  private http = inject(HttpClient);
  private router = inject(Router);
  private toast = inject(ToastService);
  items = signal<AssignedDto[]>([]);
  constructor(){ this.load(); }
  load(){
    this.http.get<AssignedDto[]>(`/api/elections/assigned?role=${Roles.VoteRegistrar}`).subscribe({ next: d=> this.items.set(d||[]), error: _=> this.items.set([]) });
  }
  start(id: string){
    this.http.get<any>(`/api/elections/${id}/status`).subscribe({
      next: s => {
        const st = (s?.Status ?? s?.status ?? 'Draft');
        if (st !== 'VotingOpen') { this.toast.show('La votaciÃ³n no estÃ¡ abierta','warning',2000); return; }
        this.router.navigate(['/elections', id]);
      },
      error: _=> this.toast.show('No se pudo comprobar el estado','error',2000)
    });
  }
}


