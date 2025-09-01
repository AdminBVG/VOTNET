import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { LiveService } from '../../core/live.service';
import { AuthService } from '../../core/auth.service';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

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
  imports: [MatTableModule, NgIf, NgFor, DatePipe, MatButtonModule],
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
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="cols"></tr>
      <tr mat-row *matRowDef="let row; columns: cols;"></tr>
    </table>
    <div *ngIf="!items().length">No hay datos o no tienes permisos.</div>
  </div>
  `,
  styles: [`.page{ padding:16px } table.full{ width:100% } .actions{ display:flex; gap:8px }`]
})
export class ElectionsComponent {
  private http = inject(HttpClient);
  private live = inject(LiveService);
  private router = inject(Router);
  private auth = inject(AuthService);
  items = signal<ElectionDto[]>([]);
  cols = ['name','date','quorum','actions'];

  constructor(){
    this.load();
    this.live.onVoteRegistered(()=> this.load());
  }
  load(){ this.http.get<ElectionDto[]>(`/api/elections`).subscribe({ next: d=> this.items.set(d), error: ()=> this.items.set([]) }); }
  open(row: ElectionDto){ this.router.navigate(['/elections', row.id]); }
  get isAdmin(){ return this.auth.hasRole('GlobalAdmin') || this.auth.hasRole('VoteAdmin'); }
  edit(row: ElectionDto){ if (!this.isAdmin) return; this.router.navigate(['/elections', row.id], { queryParams: { mode: 'edit' } }); }
  editPadron(row: ElectionDto){ if (!this.isAdmin) return; this.router.navigate(['/elections', row.id, 'padron-edit']); }
}
