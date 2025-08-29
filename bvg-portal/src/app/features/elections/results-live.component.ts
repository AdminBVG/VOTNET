import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgFor, NgIf } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { LiveService } from '../../core/live.service';

@Component({
  selector: 'app-results-live',
  standalone: true,
  imports: [NgFor, NgIf, MatCardModule, MatFormFieldModule, MatSelectModule, MatTableModule],
  template: `
  <div class="page">
    <h2>Resultados en vivo</h2>
    <mat-form-field appearance="outline" class="full">
      <mat-label>Elección</mat-label>
      <mat-select [(value)]="selectedId" (valueChange)="loadResults()">
        <mat-option *ngFor="let e of elections()" [value]="e.id">{{e.name}}</mat-option>
      </mat-select>
    </mat-form-field>

    <div *ngIf="results().length; else empty">
      <mat-card class="q" *ngFor="let q of results()">
        <h3>{{q.text}}</h3>
        <table mat-table [dataSource]="q.options" class="mat-elevation-z1">
          <ng-container matColumnDef="text">
            <th mat-header-cell *matHeaderCellDef>Opción</th>
            <td mat-cell *matCellDef="let o">{{o.text}}</td>
          </ng-container>
          <ng-container matColumnDef="votes">
            <th mat-header-cell *matHeaderCellDef>Votos</th>
            <td mat-cell *matCellDef="let o">{{o.votes}}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="resCols"></tr>
          <tr mat-row *matRowDef="let row; columns: resCols;"></tr>
        </table>
      </mat-card>
    </div>
    <ng-template #empty>
      <p>Seleccione una elección para ver resultados.</p>
    </ng-template>
  </div>
  `,
  styles: [`.q{margin-bottom:12px}.full{width:100%}`]
})
export class ResultsLiveComponent {
  private http = inject(HttpClient);
  private live = inject(LiveService);
  elections = signal<any[]>([]);
  selectedId: string | null = null;
  results = signal<any[]>([]);
  resCols = ['text','votes'];

  constructor(){
    this.http.get<any[]>(`/api/elections`).subscribe({ next: d => this.elections.set(d) });
    this.live.onVoteRegistered(()=> this.loadResults());
  }

  loadResults(){
    if (!this.selectedId) { this.results.set([]); return; }
    this.http.get<any[]>(`/api/elections/${this.selectedId}/results`).subscribe({ next: d => this.results.set(d) });
  }
}

