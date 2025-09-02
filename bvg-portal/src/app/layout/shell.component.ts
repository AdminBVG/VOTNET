import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { NgIf } from '@angular/common';
import { AuthService } from '../core/auth.service';
import { ThemeService } from '../core/theme.service';
import { ConfigService } from '../core/config.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, MatToolbarModule, MatButtonModule, MatMenuModule, MatDividerModule, NgIf],
  template: `
  <mat-toolbar>
    <a routerLink="/dashboard" class="brand-link" aria-label="Ir al inicio">
      <img [src]="cfg.logoUrl()" alt="Logo" height="36"/>
    </a>
    <span class="spacer"></span>
    <a mat-button routerLink="/dashboard" routerLinkActive="active">Inicio</a>
    <button mat-button [matMenuTriggerFor]="menuElec">Elecciones</button>
    <mat-menu #menuElec="matMenu">
      <button mat-menu-item routerLink="/elections/new" routerLinkActive="active" *ngIf="isAdmin">Crear elección</button>
      <button mat-menu-item routerLink="/elections" routerLinkActive="active" *ngIf="isAdmin">Historial de elecciones</button>
      <button mat-menu-item routerLink="/elections/live" routerLinkActive="active" *ngIf="isAdmin">Resultados en vivo</button>
      <button mat-menu-item routerLink="/attendance" routerLinkActive="active">Mis asignaciones</button>
    </mat-menu>
    <a mat-button routerLink="/users" *ngIf="isGlobalAdmin">Usuarios</a>
    <a mat-button routerLink="/config" *ngIf="isGlobalAdmin">Configuración</a>
    <button mat-stroked-button color="primary" (click)="toggleTheme()">Tema: {{ theme() }}</button>
    <button mat-button (click)="logout()">Salir</button>
  </mat-toolbar>
  <div class="container">
    <router-outlet></router-outlet>
  </div>
  <footer class="app-footer">
    <div class="footer-gradient"></div>
    <div class="footer-inner">
      <div class="col brand">
        <img src="assets/bvg-logo-white.png" alt="BVG" class="footer-logo"/>
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
    mat-toolbar { box-shadow: 0 2px 6px rgba(0,0,0,.08) }
    a[mat-button].active{ position:relative }
    a[mat-button].active::after{ content:''; position:absolute; left:8px; right:8px; bottom:4px; height:3px; background:#fff; border-radius:2px; opacity:.9 }
    .app-footer{ margin-top:32px; position:relative; background: #0c1524; color:#fff; border-top: 4px solid var(--bvg-blue) }
    .footer-gradient{ position:absolute; inset:0; background: linear-gradient(135deg, #001489 0%, #005EB8 100%); opacity:.22; pointer-events:none }
    .app-footer .footer-inner{ position:relative; display:grid; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); gap:28px; padding:28px; align-items:flex-start }
    .app-footer .footer-copy{ padding:14px 28px; background: rgba(255,255,255,0.06); font-size:12px; letter-spacing:.2px }
    .app-footer h4{ margin:0 0 10px 0; font-size:13px; letter-spacing:.6px; text-transform:uppercase; opacity:.9 }
    .app-footer a{ display:block; color:#fff; text-decoration:none; opacity:.86; margin:6px 0; transition: opacity .15s ease, transform .15s ease }
    .app-footer a:hover{ text-decoration:underline; opacity:1; transform: translateX(2px) }
    .brand{ display:flex; align-items:center; gap:14px }
    .footer-logo{ height:60px; width:auto; object-fit:contain; filter: drop-shadow(0 2px 6px rgba(0,0,0,.35)) }
    .brand-link{ display:flex; align-items:center; margin-right:12px }
    .col{ display:flex; flex-direction:column }
  `]
})
export class ShellComponent {
  private auth = inject(AuthService);
  private themeSvc = inject(ThemeService);
  cfg = inject(ConfigService);
  logout(){ this.auth.logout(); }
  year = new Date().getFullYear();
  get isGlobalAdmin(){ return this.auth.hasRole('GlobalAdmin'); }
  get isAdmin(){ return this.auth.hasRole('GlobalAdmin') || this.auth.hasRole('VoteAdmin'); }
  ngOnInit(){
    this.themeSvc.init();
    if (this.auth.isAuthenticated){
      // Asegurar cookie/token XSRF para las peticiones mutantes
      this.auth.ensureXsrfToken().subscribe({ next: _=>{}, error: _=>{} });
    }
  }
  theme(){ return this.themeSvc.current() === 'dark' ? 'Oscuro' : 'Claro'; }
  toggleTheme(){ this.themeSvc.toggle(); }
}
