import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { NgFor } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [MatCardModule, NgFor],
  template: `
  <div class="dash">
    <mat-card class="hero" appearance="outlined">
      <div class="hero-left">
        <h2>Bienvenido al Portal de Votaciones</h2>
        <p>Administra elecciones, padrones, asistencia y resultados en tiempo real.</p>
        <div class="cta">
          <a mat-stroked-button color="primary" routerLink="/elections">Ver elecciones</a>
          <a mat-stroked-button routerLink="/users">Gestionar usuarios</a>
        </div>
      </div>
      <div class="hero-right">
        <img src="assets/vote-hero.png" alt="votaciones" />
      </div>
    </mat-card>
  </div>
  `,
  styles: [`
    .dash{ display:flex; flex-direction:column; gap:20px }
    .hero{ display:grid; grid-template-columns: 1.2fr 1fr; align-items:center; padding:16px }
    .hero-right{ display:flex; justify-content:flex-end }
    .hero-right img{ max-height:220px; width:auto; object-fit:contain }
    .hero-left h2{ margin:0 0 8px 0 }
    .hero-left p{ margin:0 0 14px 0; opacity:.9 }
    .cta{ display:flex; gap:12px; flex-wrap:wrap }
    @media (max-width: 800px){
      .hero{ grid-template-columns: 1fr; }
      .hero-right{ justify-content:center; }
    }
  `]
})
export class DashboardComponent {}
