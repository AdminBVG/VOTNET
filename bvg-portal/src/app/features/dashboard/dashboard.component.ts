import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { NgIf, DatePipe, AsyncPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [MatCardModule, NgIf, DatePipe, AsyncPipe],
  template: `
  <div class="dash">
    <mat-card class="hero" appearance="outlined">
      <div class="hero-left">
        <h2>Bienvenido al Portal de Votaciones</h2>
        <p class="sub">Mantente al día con el estado de tus procesos.</p>

        <div class="info-grid">
          <div class="info">
            <div class="label">Fecha y hora</div>
            <div class="value time">{{ now() | date:'fullDate' }} · {{ now() | date:'HH:mm:ss' }}</div>
          </div>

          <div class="info" *ngIf="nextElection() as nx; else noNext">
            <div class="label">Próxima elección</div>
            <div class="value">{{ nx.name }} · {{ nx.scheduledAt | date:'medium' }}</div>
            <div class="countdown" *ngIf="countdown() as cd">Comienza en: {{ cd.d }}d {{ cd.h }}h {{ cd.m }}m {{ cd.s }}s</div>
          </div>
          <ng-template #noNext>
            <div class="info">
              <div class="label">Próxima elección</div>
              <div class="value muted">Sin elecciones próximas</div>
            </div>
          </ng-template>

          <div class="info">
            <div class="label">Próximos 7 días</div>
            <div class="value">{{ upcomingCount() }} programadas</div>
          </div>

          <div class="info live">
            <span class="dot" [class.on]="liveConnected()"></span>
            <div class="label">Actualizaciones en vivo</div>
            <div class="value">{{ liveConnected() ? 'Conectado' : 'Reconectando...' }}</div>
          </div>
        </div>
      </div>
      <div class="hero-right">
        <img src="assets/vote-hero.png" alt="votaciones" />
      </div>
    </mat-card>
  </div>
  `,
  styles: [`
    .dash{ display:flex; flex-direction:column; gap:24px }
    .hero{ display:grid; grid-template-columns: 1.2fr 1fr; align-items:center; padding:22px; border-radius:10px }
    .hero-right{ display:flex; justify-content:flex-end; padding-right:16px }
    .hero-right img{ max-height:320px; width:auto; object-fit:contain; filter: drop-shadow(0 6px 18px rgba(0,0,0,.18)) }
    .hero-left h2{ margin:0 0 8px 0 }
    .sub{ margin:0 0 18px 0; opacity:.9 }
    .info-grid{ display:grid; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); gap:14px }
    .info{ background: var(--surface); border: 1px solid rgba(0,0,0,.06); border-radius:8px; padding:12px 14px; display:flex; flex-direction:column; gap:4px }
    .info.live{ flex-direction:row; align-items:center; gap:10px }
    .label{ font-size:12px; opacity:.75; letter-spacing:.3px }
    .value{ font-weight:600 }
    .value.time{ font-variant-numeric: tabular-nums }
    .value.muted{ opacity:.7; font-weight:500 }
    .countdown{ font-size:13px; opacity:.9 }
    .dot{ width:10px; height:10px; border-radius:50%; background:#bbb; display:inline-block }
    .dot.on{ background:#2ecc71; box-shadow: 0 0 0 0 rgba(46,204,113,.6); animation: pulse 1.8s infinite }
    @keyframes pulse{ 0%{ box-shadow:0 0 0 0 rgba(46,204,113,.6) } 70%{ box-shadow:0 0 0 8px rgba(46,204,113,0) } 100%{ box-shadow:0 0 0 0 rgba(46,204,113,0) } }
    @media (max-width: 800px){
      .hero{ grid-template-columns: 1fr; }
      .hero-right{ justify-content:center; }
      .hero-right img{ max-height:220px }
    }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  now = signal(new Date());
  nextElection = signal<{ id:string; name:string; scheduledAt: Date } | null>(null);
  upcomingCount = signal(0);
  liveConnected = signal(false);
  private timer?: any;
  private hub?: signalR.HubConnection;

  ngOnInit(){
    this.tick();
    this.timer = setInterval(()=> this.tick(), 1000);
    this.loadElections();
    this.initHub();
  }

  ngOnDestroy(){ if (this.timer) clearInterval(this.timer); this.hub?.stop(); }

  countdown(){
    const nx = this.nextElection(); if (!nx) return null;
    const now = this.now().getTime(); const target = nx.scheduledAt.getTime();
    let diff = Math.max(0, Math.floor((target - now)/1000));
    const d = Math.floor(diff/86400); diff -= d*86400;
    const h = Math.floor(diff/3600); diff -= h*3600;
    const m = Math.floor(diff/60); const s = diff - m*60;
    return { d, h, m, s };
  }

  private tick(){ this.now.set(new Date()); }

  private loadElections(){
    const isAdmin = this.auth.hasRole('GlobalAdmin') || this.auth.hasRole('VoteAdmin');
    let url = '/api/elections';
    if (!isAdmin) {
      const role = this.auth.roles.find(r => ['AttendanceRegistrar','VoteRegistrar','ElectionVoter','ElectionObserver'].includes(r)) || 'AttendanceRegistrar';
      url = `/api/elections/assigned?role=${role}`;
    }
    this.http.get<any[]>(url).subscribe({
      next: list => {
        const now = new Date();
        const items = (list||[]).map(e=>({ id: e.id, name: e.name, scheduledAt: new Date(e.scheduledAt)}));
        const future = items.filter(x => x.scheduledAt.getTime() > now.getTime());
        future.sort((a,b)=> a.scheduledAt.getTime() - b.scheduledAt.getTime());
        this.nextElection.set(future[0] || null);
        const in7d = future.filter(x => x.scheduledAt.getTime() - now.getTime() <= 7*24*3600*1000).length;
        this.upcomingCount.set(in7d);
      },
      error: _ => { this.nextElection.set(null); this.upcomingCount.set(0); }
    });
  }

  private initHub(){
    try{
      this.hub = new signalR.HubConnectionBuilder().withUrl('/hubs/live').withAutomaticReconnect().build();
      this.hub.onreconnected(_=> this.liveConnected.set(true));
      this.hub.onreconnecting(_=> this.liveConnected.set(false));
      this.hub.onclose(_=> this.liveConnected.set(false));
      this.hub.start().then(()=> this.liveConnected.set(true)).catch(()=> this.liveConnected.set(false));
    } catch { this.liveConnected.set(false); }
  }
}
