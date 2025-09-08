import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgIf, NgFor, NgClass, DatePipe } from '@angular/common';
import { LiveService } from '../../core/live.service';
import { AuthService } from '../../core/auth.service';
import { Router } from '@angular/router';
import { UiButtonDirective } from '../../ui/button.directive';

interface ElectionDto {
  id: string;
  name: string;
  details: string;
  scheduledAt: string;
  quorumMinimo: number;
}

@Component({
  selector: 'app-elections',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, DatePipe, UiButtonDirective],
  template: `
  <div class="p-4">
    <h2 class="text-xl font-semibold mb-2">Historial de elecciones</h2>
    <table class="w-full text-sm border border-gray-200 rounded-xl overflow-hidden" *ngIf="items().length">
      <thead class="bg-gray-50 text-gray-600">
        <tr>
          <th class="text-left p-2">Nombre</th>
          <th class="text-left p-2">Fecha</th>
          <th class="text-left p-2">Estado</th>
          <th class="text-left p-2">Quórum</th>
          <th class="w-72 p-2">Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let e of items()" class="border-t">
          <td class="p-2">{{e.name}}</td>
          <td class="p-2">{{e.scheduledAt | date:'short'}}</td>
          <td class="p-2">
            <span class="rounded-full px-2 py-0.5 text-xs"
                  [ngClass]="{
                    'bg-green-100 text-green-800': (statuses()[e.id]?.Status||'').toLowerCase()==='votingopen',
                    'bg-blue-100 text-blue-800': (statuses()[e.id]?.Status||'').toLowerCase()==='registrationopen',
                    'bg-amber-100 text-amber-800': (statuses()[e.id]?.Status||'').toLowerCase()==='registrationclosed',
                    'bg-red-100 text-red-800': (statuses()[e.id]?.Status||'').toLowerCase()==='votingclosed',
                    'bg-violet-100 text-violet-800': (statuses()[e.id]?.Status||'').toLowerCase()==='certified',
                    'bg-gray-100 text-gray-700': !(statuses()[e.id]?.Status)
                  }"
                  [title]="(statuses()[e.id]?.Locked ? 'Registro bloqueado' : 'Registro abierto')">
              {{statuses()[e.id]?.Status || '...'}}
            </span>
          </td>
          <td class="p-2">{{e.quorumMinimo}}</td>
          <td class="p-2">
            <div class="flex flex-wrap gap-2">
              <button uiBtn="primary" size="sm" (click)="open(e)">Ver</button>
              <button uiBtn="secondary" size="sm" (click)="edit(e)" *ngIf="isAdmin">Editar</button>
              <button uiBtn="secondary" size="sm" (click)="editPadron(e)" *ngIf="isAdmin">Editar Padrón</button>
              <button uiBtn="primary" size="sm" *ngIf="isAdmin && statuses()[e.id]?.Actions?.CanOpenReg" (click)="openRegistration(e)" [title]="'Abrir registro'">Abrir registro</button>
              <button uiBtn="primary" size="sm" *ngIf="isAdmin && statuses()[e.id]?.Actions?.CanReopenReg" (click)="reopenRegistration(e)" [title]="'Reabrir registro'">Reabrir registro</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div *ngIf="!items().length">No hay datos o no tienes permisos.</div>
  </div>
  `,
  styles: []
})
export class ElectionsComponent {
  private http = inject(HttpClient);
  private live = inject(LiveService);
  private router = inject(Router);
  private auth = inject(AuthService);
  items = signal<ElectionDto[]>([]);
  statuses = signal<Record<string, any>>({});
  cols = ['name','date','status','quorum','actions'];

  constructor(){
    this.load();
    this.live.onVoteRegistered(()=> this.load());
  }
  load(){
    this.http.get<ElectionDto[]>(`/api/elections`).subscribe({ next: d=> {
      this.items.set(d||[]);
      const current = { ...this.statuses() } as Record<string, any>;
      (d||[]).forEach(e => {
        this.http.get<any>(`/api/elections/${e.id}/status`).subscribe({ next: s => { current[e.id] = s; this.statuses.set({ ...current }); } });
      });
    }, error: ()=> this.items.set([]) });
  }
  open(row: ElectionDto){ this.router.navigate(['/elections', row.id]); }
  get isAdmin(){ return this.auth.hasRole('GlobalAdmin') || this.auth.hasRole('VoteAdmin'); }
  edit(row: ElectionDto){ if (!this.isAdmin) return; this.router.navigate(['/elections', row.id], { queryParams: { mode: 'edit' } }); }
  editPadron(row: ElectionDto){ if (!this.isAdmin) return; this.router.navigate(['/elections', row.id, 'padron-edit']); }
  openRegistration(row: ElectionDto){ if (!this.isAdmin) return; this.http.post(`/api/elections/${row.id}/status/open-registration`,{}).subscribe({ next: _=> this.load() }); }
  reopenRegistration(row: ElectionDto){ if (!this.isAdmin) return; this.http.post(`/api/elections/${row.id}/status/reopen-registration`,{ confirm:true }).subscribe({ next: _=> this.load() }); }
}

