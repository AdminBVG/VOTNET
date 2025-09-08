import { Component } from '@angular/core';

type ToastType = 'info' | 'success' | 'warning' | 'error';

import { NgFor, NgClass } from '@angular/common';
import { UiIconComponent } from '../icon.component';

@Component({
  selector: 'app-ui-toast-container',
  standalone: true,
  imports: [NgFor, NgClass, UiIconComponent],
  template: `
  <div class="space-y-2 max-w-sm" role="region" aria-live="polite" aria-atomic="true">
    <div *ngFor="let t of toasts" class="rounded-xl shadow-card px-4 py-3 text-sm flex items-start gap-3" role="status"
         [class.bg-white]="t.type==='info'" [class.bg-green-50]="t.type==='success'"
         [class.bg-amber-50]="t.type==='warning'" [class.bg-red-50]="t.type==='error'"
         [class.border]="true" [class.border-green-200]="t.type==='success'"
         [class.border-amber-200]="t.type==='warning'" [class.border-red-200]="t.type==='error'">
      <div class="mt-0.5" [ngClass]="{
        'text-brand-primary': t.type==='info',
        'text-green-600': t.type==='success',
        'text-amber-700': t.type==='warning',
        'text-red-600': t.type==='error'
      }">
        <ui-icon [name]="t.type==='success' ? 'success' : (t.type==='warning' ? 'warning' : (t.type==='error' ? 'error' : 'info'))" [size]="18"></ui-icon>
      </div>
      <div class="flex-1">{{t.message}}</div>
      <button class="text-gray-500 hover:text-gray-700" type="button" aria-label="Cerrar" (click)="dismiss(t)">
        <ui-icon name="close" [size]="16"></ui-icon>
      </button>
    </div>
  </div>
  `
})
export class UiToastContainerComponent {
  toasts: { message: string; type: ToastType; duration: number; created?: number }[] = [];

  push(t: { message: string; type: ToastType; duration: number }){
    const toast = { ...t, created: Date.now() };
    this.toasts.push(toast);
    setTimeout(() => this.dismiss(toast), t.duration);
  }
  dismiss(t: any){
    const i = this.toasts.indexOf(t);
    if (i >= 0) this.toasts.splice(i, 1);
  }
}


