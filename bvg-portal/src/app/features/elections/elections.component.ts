import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgIf, NgFor, NgClass, DatePipe } from '@angular/common';
import { UiIconComponent } from '../../ui/icon.component';
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
  imports: [NgIf, NgFor, NgClass, DatePipe, UiButtonDirective, UiIconComponent],
  template: `
  <div class="p-4">
    <h2 class="text-xl font-semibold mb-2">Historial de elecciones</h2>

    <div *ngIf="loading(); else listOrEmpty">
      <div class="rounded-2xl border border-gray-200 bg-white shadow-card p-4 mb-3">
        <div class="skeleton-line w-64 mb-2"></div>
        <div class="skeleton-line w-full mb-2"></div>
        <div class="skeleton-line w-5/6"></div>
      </div>
    </div>

    <ng-template #listOrEmpty>
    <table class="table-base table-compact thead-sticky row-zebra" *ngIf="items().length; else empty">
      <thead>
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
              <button uiBtn="secondary" size="sm" (click)="editPadron(e)" *ngIf="isAdmin">Editar PadrÃ³n</button>
              <button uiBtn="primary" size="sm" *ngIf="isAdmin && statuses()[e.id]?.Actions?.CanOpenReg" (click)="openRegistration(e)" [title]="'Abrir registro'">Abrir registro</button>
              <button uiBtn="primary" size="sm" *ngIf="isAdmin && statuses()[e.id]?.Actions?.CanReopenReg" (click)="reopenRegistration(e)" [title]="'Reabrir registro'">Reabrir registro</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <ng-template #empty>
      <div class="rounded-2xl border border-gray-200 bg-white shadow-card p-10 flex flex-col items-center gap-2 text-muted">
        <ui-icon name="empty" [size]="48"></ui-icon>
        <div>No hay datos o no tienes permisos.</div>
      </div>
    </ng-template>
    </ng-template>
  </div>
  `,
  styles: []
})
export class ElectionsComponent {`n  private autoOpened = new Set<string>();
  private http = inject(HttpClient);
  private live = inject(LiveService);
  private router = inject(Router);
  private auth = inject(AuthService);
  items = signal<ElectionDto[]>([]);
  statuses = signal<Record<string, any>>({});
  loading = signal(true);
  cols = ['name','date','status','quorum','actions'];

  constructor(){
    this.load();
    this.live.onVoteRegistered(()=> this.load());
  }
  load(){
    this.http.get<ElectionDto[]>(`/api/elections`).subscribe({ next: d=> {
      this.items.set(d||[]); this.loading.set(false);
      const current = { ...this.statuses() } as Record<string, any>;
      (d||[]).forEach(e => {
        this.http.get<any>(`/api/elections/${e.id}/status`).subscribe({ next: s => { current[e.id] = s; this.statuses.set({ ...current }); try{ if (this.isAdmin && s?.Actions?.CanOpenReg && !this.autoOpened.has(e.id)){ const now = Date.now(); const sched = new Date(e.scheduledAt).getTime(); if (now >= sched - 30*60*1000){ this.autoOpened.add(e.id); this.openRegistration(e); } } } catch {} } });
      });
    }, error: ()=> { this.items.set([]); this.loading.set(false); } });
  }
  open(row: ElectionDto){ this.router.navigate(['/elections', row.id]); }
  get isAdmin(){ return this.auth.hasRole('GlobalAdmin') || this.auth.hasRole('VoteAdmin'); }
  edit(row: ElectionDto){ if (!this.isAdmin) return; this.router.navigate(['/elections', row.id], { queryParams: { mode: 'edit' } }); }
  editPadron(row: ElectionDto){ if (!this.isAdmin) return; this.router.navigate(['/elections', row.id, 'padron-edit']); }
  openRegistration(row: ElectionDto){ if (!this.isAdmin) return; this.http.post(`/api/elections/${row.id}/status/open-registration`,{}).subscribe({ next: _=> this.load() }); }
  reopenRegistration(row: ElectionDto){ if (!this.isAdmin) return; this.http.post(`/api/elections/${row.id}/status/reopen-registration`,{ confirm:true }).subscribe({ next: _=> this.load() }); }
}




