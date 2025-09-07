import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgFor, NgIf, DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { LiveService } from '../../core/live.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-results-live',
  standalone: true,
  imports: [NgFor, NgIf, DecimalPipe, MatCardModule, MatFormFieldModule, MatSelectModule, MatTableModule],
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
      <mat-card class="q" *ngFor="let q of results(); let i = index">
        <h3>{{q.text}}</h3>
        <div class="chart-container"><canvas id="live-chart-{{i}}"></canvas></div>
        <table mat-table [dataSource]="q.options" class="mat-elevation-z1">
          <ng-container matColumnDef="text">
            <th mat-header-cell *matHeaderCellDef>Opción</th>
            <td mat-cell *matCellDef="let o">{{o.text}}</td>
          </ng-container>
          <ng-container matColumnDef="votes">
            <th mat-header-cell *matHeaderCellDef>Votos</th>
            <td mat-cell *matCellDef="let o">{{o.votes}}</td>
          </ng-container>
          <ng-container matColumnDef="percent">
            <th mat-header-cell *matHeaderCellDef>%</th>
            <td mat-cell *matCellDef="let o">{{ (o.percent || o.Percent)*100 | number:'1.0-2' }}%</td>
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
  styles: [`.q{margin-bottom:12px}.full{width:100%}.chart-container{max-width:300px;margin-bottom:8px}`]
})
export class ResultsLiveComponent {
  private http = inject(HttpClient);
  private live = inject(LiveService);
  elections = signal<any[]>([]);
  selectedId: string | null = null;
  private prevId: string | null = null;
  results = signal<any[]>([]);
  resCols = ['text','votes','percent'];
  charts: Chart[] = [];

  constructor(){
    this.http.get<any[]>(`/api/elections`).subscribe({ next: d => this.elections.set(d) });
    this.live.onVoteRegistered(()=> this.loadResults());
  }

  loadResults(){
    if (!this.selectedId) { this.results.set([]); return; }
    if (this.prevId && this.prevId !== this.selectedId) this.live.leaveElection(this.prevId);
    this.live.joinElection(this.selectedId);
    this.prevId = this.selectedId;
    this.http.get<any[]>(`/api/elections/${this.selectedId}/results`).subscribe({ next: d => { this.results.set(d); setTimeout(()=>this.renderCharts(),0); } });
  }
  ngOnDestroy(){ if (this.prevId) this.live.leaveElection(this.prevId); }

  renderCharts(){
    this.charts.forEach(c=>c.destroy());
    this.charts = [];
    this.results().forEach((q:any, idx:number) => {
      const canvas = document.getElementById(`live-chart-${idx}`) as HTMLCanvasElement | null;
      if (!canvas) return;
      const opts = q.options ?? q.Options ?? [];
      const labels = opts.map((o:any)=>o.text);
      const data = opts.map((o:any)=>o.votes);
      const colors = labels.map((_:any,i:number)=>`hsl(${(i*60)%360},70%,70%)`);
      this.charts.push(new Chart(canvas,{type:'pie', data:{labels, datasets:[{data, backgroundColor:colors}]}}));
    });
  }
}

