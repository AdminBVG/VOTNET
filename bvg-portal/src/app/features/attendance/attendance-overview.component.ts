import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NgIf, NgStyle, DecimalPipe } from '@angular/common';
import { LiveService } from '../../core/live.service';

@Component({
  selector: 'app-attendance-overview',
  standalone: true,
  imports: [NgIf, NgStyle, DecimalPipe],
  template: `
  <div class="page">
    <h2>Asistencia - Resumen</h2>
    <div *ngIf="loaded(); else loading">
      <div class="charts">
        <div class="donut" [ngStyle]="chartStyle()">
          <div class="hole">
            <div class="center">
              <div class="num">{{(data()?.presencial||0)+(data()?.virtual||0)}}</div>
              <div class="sub">Presentes</div>
            </div>
          </div>
        </div>
        <div class="legend">
          <span class="item"><span class="box presencial"></span> Presencial: {{data()?.presencial || 0}}</span>
          <span class="item"><span class="box virtual"></span> Virtual: {{data()?.virtual || 0}}</span>
          <span class="item"><span class="box ausente"></span> Ausente: {{data()?.ausente || 0}}</span>
          <span class="item"><span class="box total"></span> Total: {{data()?.total || 0}}</span>
        </div>
        <div class="quorum" *ngIf="data() as d">
          <div>QuÃ³rum: {{presentSharePct()}}% de {{d.totalShares | number:'1.0-0'}} acciones (mÃ­n: {{(d.quorumMin*100) | number:'1.0-0'}}%)</div>
          <div class="bar"><div class="p" [style.width.%]="presentSharePct()"></div></div>
        </div>
      </div>
    </div>
    <ng-template #loading>
      <div class="muted">Cargando...</div>
    </ng-template>
  </div>
  `,
  styles: [`
    .page{ padding:16px }
    .charts{ display:flex; align-items:center; gap:16px; margin-bottom:8px }
    .donut{ width:160px; height:160px; border-radius:50%; position:relative; background:#eee }
    .donut .hole{ position:absolute; inset:20px; background:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center }
    .donut .center{ text-align:center; line-height:1 }
    .donut .num{ font-size:22px; font-weight:600 }
    .donut .sub{ font-size:12px; opacity:.75 }
    .legend{ display:flex; gap:12px; flex-wrap:wrap; font-size:13px; opacity:.95 }
    .legend .box{ display:inline-block; width:12px; height:12px; border-radius:3px; margin-right:6px }
    .legend .presencial{ background:#2e7d32 }
    .legend .virtual{ background:#1565c0 }
    .legend .ausente{ background:#9e9e9e }
    .legend .total{ background:#555 }
    .quorum{ margin-top:8px; font-size:13px }
    .bar{ height:6px; border-radius:4px; background:#eee; overflow:hidden; margin-top:4px; max-width:360px }
    .bar .p{ height:100%; background: var(--bvg-blue) }
    .muted{ opacity:.75 }
  `]
})
export class AttendanceOverviewComponent{
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private live = inject(LiveService);
  id = this.route.snapshot.params['id'];
  data = signal<{ total:number; presencial:number; virtual:number; ausente:number; totalShares:number; presentShares:number; quorumMin:number; locked:boolean }|null>(null);
  loaded = signal(false);

  constructor(){
    this.http.get<any>(`/api/elections/${this.id}/attendance/summary`).subscribe({
      next: d=> { this.data.set(d); this.loaded.set(true); }, error: _=> { this.data.set({ total:0, presencial:0, virtual:0, ausente:0, totalShares:0, presentShares:0, quorumMin:0, locked:false }); this.loaded.set(true); }
    });
    this.live.onAttendanceSummary(p => { if (p && p.ElectionId === this.id) this.http.get<any>(`/api/elections/${this.id}/attendance/summary`).subscribe({ next: d=> this.data.set(d) }); });
  }
  chartStyle(){
    const d = this.data(); const total = d?.total || 1;
    const p = Math.round(((d?.presencial||0)/total)*100);
    const v = Math.round(((d?.virtual||0)/total)*100);
    const g = `conic-gradient(#2e7d32 0 ${p}%, #1565c0 ${p}% ${p+v}%, #9e9e9e ${p+v}% 100%)`;
    return { background: g } as any;
  }
  presentSharePct(){ const d=this.data(); const t=d?.totalShares||0; const ps=d?.presentShares||0; if(!t) return 0; return Math.round(ps/t*100); }
}
