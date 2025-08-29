import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { NgIf } from '@angular/common';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, MatToolbarModule, MatButtonModule, MatMenuModule, MatDividerModule, NgIf],
  template: `
  <mat-toolbar>
    <img src="assets/bvg-logo.png" alt="BVG" height="36" style="margin-right:12px"/>
    <span style="font-weight:600">BVG Portal</span>
    <span class="spacer"></span>
    <a mat-button routerLink="/dashboard">Inicio</a>
    <button mat-button [matMenuTriggerFor]="menuElec">Elecciones</button>
    <mat-menu #menuElec="matMenu">
      <button mat-menu-item routerLink="/elections/new" *ngIf="canCreate">Crear elección</button>
      <button mat-menu-item routerLink="/elections">Padrón y asistencia</button>
      <button mat-menu-item routerLink="/elections/live">Resultados en vivo</button>
      <mat-divider></mat-divider>
      <button mat-menu-item routerLink="/elections">Ver elecciones</button>
    </mat-menu>
    <a mat-button routerLink="/users" *ngIf="isGlobalAdmin">Usuarios</a>
    <button mat-button (click)="logout()">Salir</button>
  </mat-toolbar>
  <div class="container">
    <router-outlet></router-outlet>
  </div>
  <footer class="app-footer">
    <div class="footer-inner">
      <div class="col brand">
        <img src="assets/bvg-logo-white.png" alt="BVG" height="34"/>
        <div class="brand-text">Bolsa de Valores de Guayaquil</div>
      </div>
      <div class="col">
        <h4>Enlaces</h4>
        <a href="#" target="_blank" rel="noopener">Sitio web</a>
        <a href="#" target="_blank" rel="noopener">Políticas</a>
        <a href="#" target="_blank" rel="noopener">Términos</a>
      </div>
      <div class="col">
        <h4>Contacto</h4>
        <div>Guayaquil, Ecuador</div>
        <div>Tel: +593 000 000 000</div>
        <div>Email: info&#64;bvg.ec</div>
      </div>
    </div>
    <div class="footer-copy">&copy; {{ year }} BVG. Todos los derechos reservados.</div>
  </footer>
  `,
  styles: [`
    .spacer{flex:1}
    .app-footer{ margin-top:32px; background: var(--bvg-dark); color:#fff; border-top: 4px solid var(--bvg-blue) }
    .app-footer .footer-inner{ display:grid; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); gap:24px; padding:24px; align-items:flex-start }
    .app-footer .footer-copy{ padding:12px 24px; background: rgba(255,255,255,0.06); font-size:12px }
    .app-footer h4{ margin:0 0 8px 0; font-size:14px; letter-spacing:.3px }
    .app-footer a{ display:block; color:#fff; text-decoration:none; opacity:.9; margin:4px 0 }
    .app-footer a:hover{ text-decoration:underline; opacity:1 }
    .brand{ display:flex; align-items:center; gap:10px }
    .brand-text{ font-weight:600; letter-spacing:.2px }
    .col{ display:flex; flex-direction:column }
  `]
})
export class ShellComponent {
  private auth = inject(AuthService);
  logout(){ this.auth.logout(); }
  year = new Date().getFullYear();
  get isGlobalAdmin(){ return this.auth.hasRole('GlobalAdmin'); }
  get canCreate(){ return this.auth.hasRole('GlobalAdmin') || this.auth.hasRole('VoteAdmin'); }
}
