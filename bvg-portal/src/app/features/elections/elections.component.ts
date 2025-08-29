import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { ElectionFormComponent } from './election-form.component';
import { LiveService } from '../../core/live.service';
import { Router } from '@angular/router';

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
  imports: [MatTableModule, NgIf, NgFor, DatePipe, ElectionFormComponent],
  template: `
  <div class="page">
    <h2>Elecciones</h2>
    <div style="margin:8px 0">
      <button mat-raised-button color="primary" (click)="goNew()">Nueva elección</button>
    </div>
    <app-election-form></app-election-form>
    <h3 style="margin-top:16px">Listado</h3>
    <table mat-table [dataSource]="items()" class="mat-elevation-z1 clickable" *ngIf="items().length">
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
      <tr mat-header-row *matHeaderRowDef="cols"></tr>
      <tr mat-row *matRowDef="let row; columns: cols;" (click)="open(row)"></tr>
    </table>
    <div *ngIf="!items().length">No hay datos o no tienes permisos.</div>
  </div>
  `,
  styles: [`.page{ padding:16px } table{ width:100% } .clickable tr.mat-row{cursor:pointer}`]
})
export class ElectionsComponent {
  private http = inject(HttpClient);
  private live = inject(LiveService);
  private router = inject(Router);
  items = signal<ElectionDto[]>([]);
  cols = ['name','date','quorum'];

  constructor(){
    this.load();
    this.live.onVoteRegistered(()=> this.load());
  }
  load(){ this.http.get<ElectionDto[]>(`/api/elections`).subscribe({ next: d=> this.items.set(d), error: ()=> this.items.set([]) }); }
  open(row: ElectionDto){ this.router.navigate(['/elections', row.id]); }
  goNew(){ this.router.navigate(['/elections/new']); }
}
