import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { NgIf, NgFor } from '@angular/common';
import { AuthService } from '../core/auth.service';
import { ThemeService } from '../core/theme.service';
import { ConfigService } from '../core/config.service';
import { LiveService } from '../core/live.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, NgIf, NgFor],
    template: `
  <header class="w-full shadow-sm bg-gradient-to-r from-brand-dark to-brand-primary text-white">
    <div class="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
      <a routerLink="/dashboard" class="brand-link" aria-label="Ir al inicio">
        <img [src]="cfg.logoUrl()" alt="Logo" class="h-9"/>
      </a>
      <span class="spacer"></span>
      <a routerLink="/dashboard" routerLinkActive="active-link" class="px-3 py-1.5 rounded-lg hover:bg-white/10">Inicio</a>
      <div class="relative" (mouseleave)="elecOpen=false">
        <button class="px-3 py-1.5 rounded-lg hover:bg-white/10" (mouseenter)="elecOpen=true" (click)="elecOpen=!elecOpen">Elecciones</button>
        <div class="absolute right-0 mt-2 bg-white text-gray-900 rounded-xl shadow-lg min-w-56 p-2 border border-gray-100 z-20" *ngIf="elecOpen">
          <a routerLink="/elections/new" *ngIf="isAdmin" class="menu-item">Crear elección</a>
          <a routerLink="/elections" *ngIf="isAdmin" class="menu-item">Historial de elecciones</a>
          <a routerLink="/elections/live" *ngIf="isAdmin" class="menu-item">Resultados en vivo</a>
          <a routerLink="/attendance" class="menu-item">Mis asignaciones</a>
          <a routerLink="/votes" class="menu-item">Registrar votación</a>
        </div>
      </div>
      <a routerLink="/users" *ngIf="isGlobalAdmin" class="px-3 py-1.5 rounded-lg hover:bg-white/10">Usuarios</a>
      <a routerLink="/config" *ngIf="isGlobalAdmin" class="px-3 py-1.5 rounded-lg hover:bg-white/10">Configuración</a>
      <div class="relative" (mouseleave)="notifOpen=false">
        <button class="relative px-3 py-1.5 rounded-lg hover:bg-white/10" (mouseenter)="notifOpen=true" (click)="notifOpen=!notifOpen" aria-label="Notificaciones">
          <span>??</span>
          <span *ngIf="unread>0" class="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full px-1.5">{{unread}}</span>
        </button>
        <div class="absolute right-0 mt-2 bg-white text-gray-900 rounded-xl shadow-lg min-w-72 p-2 border border-gray-100 z-20" *ngIf="notifOpen">
          <div *ngIf="notifications.length; else emptyN" class="max-h-72 overflow-auto">
            <button class="menu-item" *ngFor="let n of notifications; let i = index" (click)="mark(i)"> {{n.message}}</button>
            <div class="my-1 border-t border-gray-200"></div>
            <button class="menu-item" (click)="clear()">Limpiar</button>
          </div>
          <ng-template #emptyN>
            <div class="px-3 py-2 text-sm text-gray-500">Sin notificaciones</div>
          </ng-template>
        </div>
      </div>
      <button class="px-3 py-1.5 rounded-lg border border-white/60 hover:bg-white/10" (click)="toggleTheme()">Tema: {{ theme() }}</button>
      <button class="px-3 py-1.5 rounded-lg hover:bg-white/10" (click)="logout()">Salir</button>
    </div>
  </header>
  <div class="container mx-auto px-4 py-4">
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
        <div>Email: info@bvg.ec</div>
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
  notifications: { type: 'info'|'warn'|'error', message: string }[] = [];
  unread = 0;
  private live = inject(LiveService);
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
    this.live.onSystemNotification(n => {
      if (!n || !n.Message) return;
      const type = (n.Type || 'info').toLowerCase();
      this.notifications.unshift({ type: (type==='error'?'error': type==='warn'?'warn':'info') as any, message: n.Message });
      this.unread = this.unread + 1;
    });
  }
  theme(){ return this.themeSvc.current() === 'dark' ? 'Oscuro' : 'Claro'; }
  toggleTheme(){ this.themeSvc.toggle(); }
  mark(i: number){ if (i>=0 && i < this.notifications.length) { this.notifications.splice(i,1); this.unread = Math.max(0, this.unread-1); } }
  clear(){ this.notifications = []; this.unread = 0; }
}


