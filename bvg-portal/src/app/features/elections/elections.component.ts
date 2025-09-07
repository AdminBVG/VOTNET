import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { NgIf, NgFor, NgClass, DatePipe } from '@angular/common';
import { LiveService } from '../../core/live.service';
import { AuthService } from '../../core/auth.service';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

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
  imports: [MatTableModule, NgIf, NgFor, NgClass, DatePipe, MatButtonModule, MatTooltipModule],
  template: `
  <div class="page">
    <h2>Historial de elecciones</h2>
    <table mat-table [dataSource]="items()" class="mat-elevation-z1 full" *ngIf="items().length">
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef>Nombre</th>
        <td mat-cell *matCellDef="let e">{{e.name}}</td>
      </ng-container>
      <ng-container matColumnDef="date">
        <th mat-header-cell *matHeaderCellDef>Fecha</th>
        <td mat-cell *matCellDef="let e">{{e.scheduledAt | date:'short'}}</td>
      </ng-container>
      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef>Estado</th>
        <td mat-cell *matCellDef="let e">
          <span class="chip" [ngClass]="(statuses()[e.id]?.Status||'').toLowerCase()" matTooltip="{{statuses()[e.id]?.Locked ? 'Registro bloqueado' : 'Registro abierto'}}">
            {{statuses()[e.id]?.Status || '...'}}
          </span>
        </td>
      </ng-container>
      <ng-container matColumnDef="quorum">
        <th mat-header-cell *matHeaderCellDef>Quorum</th>
        <td mat-cell *matCellDef="let e">{{e.quorumMinimo}}</td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef>Acciones</th>
        <td mat-cell *matCellDef="let e" class="actions">
          <button mat-button color="primary" (click)="open(e)">Ver</button>
          <button mat-stroked-button (click)="edit(e)" *ngIf="isAdmin">Editar</button>
          <button mat-stroked-button color="accent" (click)="editPadron(e)" *ngIf="isAdmin">Editar Padrón</button>
          <button mat-flat-button color="primary" *ngIf="isAdmin && statuses()[e.id]?.Actions?.CanOpenReg" (click)="openRegistration(e)" matTooltip="Abrir registro">Abrir registro</button>
          <button mat-flat-button color="primary" *ngIf="isAdmin && statuses()[e.id]?.Actions?.CanReopenReg" (click)="reopenRegistration(e)" matTooltip="Reabrir registro">Reabrir registro</button>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="cols"></tr>
      <tr mat-row *matRowDef="let row; columns: cols;"></tr>
    </table>
    <div *ngIf="!items().length">No hay datos o no tienes permisos.</div>
  </div>
  `,
  styles: [`.page{ padding:16px } table.full{ width:100% } .actions{ display:flex; gap:8px; flex-wrap:wrap }
  .chip{border-radius:12px;padding:2px 8px;background:#eee; font-size:12px}
  .chip.votingopen{background:#c8e6c9}
  .chip.registrationopen{background:#bbdefb}
  .chip.registrationclosed{background:#ffe0b2}
  .chip.votingclosed{background:#ffcdd2}
  .chip.certified{background:#d1c4e9}
  `]
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
