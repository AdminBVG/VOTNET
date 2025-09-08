import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { NgIf, NgFor } from '@angular/common';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { AuthService } from '../core/auth.service';
import { ThemeService } from '../core/theme.service';
import { ConfigService } from '../core/config.service';
import { LiveService } from '../core/live.service';
import { UiIconComponent } from '../ui/icon.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, NgIf, NgFor, UiIconComponent, CdkScrollable],
  template: `
  <div class="min-h-screen flex flex-col bg-bg text-text">
    <header class="w-full shadow-sm bg-gradient-to-r from-brand-dark to-brand-primary text-white">
      <div class="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
        <a routerLink="/dashboard" class="brand-link" aria-label="Ir al inicio">
          <img [src]="cfg.logoUrl()" alt="Logo" class="h-9"/>
        </a>
        <span class="spacer"></span>
        <a routerLink="/dashboard" routerLinkActive="active-link" class="px-3 py-1.5 rounded-lg hover:bg-white/10">Inicio</a>
        <div class="relative" (mouseleave)="elecOpen=false">
          <button class="px-3 py-1.5 rounded-lg hover:bg-white/10" (click)="toggleElec()" aria-haspopup="menu" [attr.aria-expanded]="elecOpen" (keydown)="onElecKey($event)">Elecciones</button>
          <div class="absolute right-0 mt-2 bg-white text-gray-900 rounded-xl shadow-lg min-w-56 p-2 border border-gray-100 z-50" *ngIf="elecOpen" role="menu" (keydown)="onMenuKey($event)">
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
            <ui-icon name="bell" [size]="18"></ui-icon>
            <span *ngIf="unread>0" class="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full px-1.5">{{unread}}</span>
          </button>
          <div class="absolute right-0 mt-2 bg-white text-gray-900 rounded-xl shadow-lg min-w-72 p-2 border border-gray-100 z-50" *ngIf="notifOpen">
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
    <main cdkScrollable class="flex-1 container mx-auto px-4 py-4">
      <router-outlet></router-outlet>
    </main>
    <footer class="site-footer bg-[#0c1524] text-white mt-8">
      <div class="max-w-7xl mx-auto px-4 py-10 grid gap-8 md:grid-cols-4">
        <div class="md:col-span-2">
          <img src="assets/bvg-logo-white.png" alt="BVG" class="h-10 w-auto"/>
          <p class="mt-3 text-sm text-white/80 max-w-prose">
            Plataforma de votaciones segura y moderna para procesos confiables.
          </p>
        </div>
        <div>
          <h4 class="footer-title">Plataforma</h4>
          <nav class="footer-links" aria-label="Enlaces de plataforma">
            <a routerLink="/dashboard">Inicio</a>
            <a routerLink="/elections">Elecciones</a>
            <a routerLink="/attendance">Asignaciones</a>
            <a routerLink="/users" *ngIf="isGlobalAdmin">Usuarios</a>
            <a routerLink="/config" *ngIf="isGlobalAdmin">Configuración</a>
          </nav>
        </div>
        <div>
          <h4 class="footer-title">Contacto</h4>
          <ul class="footer-list">
            <li>Guayaquil, Ecuador</li>
            <li>Tel: +593 000 000 000</li>
            <li>Email: info&#64;bvg.ec</li>
          </ul>
        </div>
      </div>
      <div class="border-t border-white/10 py-4 text-center text-xs text-white/70">
        &copy; {{ year }} BVG. Todos los derechos reservados.
      </div>
    </footer>
  </div>
  `,
  styles: [`
    .spacer{flex:1}
    .active-link{ position:relative }
    .active-link::after{ content:''; position:absolute; left:8px; right:8px; bottom:4px; height:3px; background:#fff; border-radius:2px; opacity:.9 }
    .menu-item{ display:block; padding:8px 12px; border-radius:10px; font-size:14px }
    .menu-item:hover{ background:#f2f5f9 }
    .footer-title{ margin:0 0 10px 0; font-size:13px; letter-spacing:.6px; text-transform:uppercase; opacity:.9 }
    .footer-links a{ display:block; color:#fff; text-decoration:none; opacity:.85; margin:6px 0; }
    .footer-links a:hover{ text-decoration:underline; opacity:1 }
    .footer-list{ list-style:none; padding:0; margin:0 }
    .footer-list li{ margin:6px 0; opacity:.9 }
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
  elecOpen = false;
  notifOpen = false;
  ngOnInit(){
    this.themeSvc.init();
    if (this.auth.isAuthenticated){
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
  toggleElec(){ this.elecOpen = !this.elecOpen; }
  onElecKey(e: KeyboardEvent){
    if(e.key==="ArrowDown"||e.key==="Enter"||e.key===" "){
      e.preventDefault(); if(!this.elecOpen) this.elecOpen=true;
      setTimeout(()=>{ const el = document.querySelector('[role=menu] .menu-item') as HTMLElement|null; el?.focus(); },0);
    }
    if(e.key==="Escape"){ this.elecOpen=false; }
  }
  onMenuKey(e: KeyboardEvent){ if(e.key==="Escape"){ e.preventDefault(); this.elecOpen=false; } }
}
