import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgFor, NgIf, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LiveService } from '../../core/live.service';
import { UiInputDirective } from '../../ui/input.directive';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-results-live',
  standalone: true,
  imports: [NgFor, NgIf, DecimalPipe, FormsModule, UiInputDirective],
  template: `
  <div class="p-4">
    <h2 class="text-xl font-semibold mb-2">Resultados en vivo</h2>
    <div class="mb-3 max-w-sm">
      <label class="text-xs opacity-80">Elección</label>
      <select uiInput [(ngModel)]="selectedId" (ngModelChange)="loadResults()">
        <option [ngValue]="null">Seleccione...</option>
        <option *ngFor="let e of elections()" [value]="e.id">{{e.name}}</option>
      </select>
    </div>

    <div *ngIf="results().length; else empty">
      <div class="rounded-2xl border border-gray-200 bg-white shadow-card p-4 mb-3" *ngFor="let q of results(); let i = index">
        <h3 class="font-semibold mb-2">{{q.text}}</h3>
        <div class="chart-container"><canvas id="live-chart-{{i}}"></canvas></div>
        <table class="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
          <thead class="bg-gray-50 text-gray-600">
            <tr>
              <th class="text-left p-2">Opción</th>
              <th class="text-left p-2">Votos</th>
              <th class="text-left p-2">%</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let o of (q.options || [])" class="border-t">
              <td class="p-2">{{o.text}}</td>
              <td class="p-2">{{o.votes}}</td>
              <td class="p-2">{{ (o.percent || o.Percent)*100 | number:'1.0-2' }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <ng-template #empty>
      <p>Seleccione una elección para ver resultados.</p>
    </ng-template>
  </div>
  `,
  styles: [`.chart-container{max-width:300px;margin-bottom:8px}`]
})
export class ResultsLiveComponent {
  private http = inject(HttpClient);
  private live = inject(LiveService);
  elections = signal<any[]>([]);
  selectedId: string | null = null;
  private prevId: string | null = null;
  results = signal<any[]>([]);
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
