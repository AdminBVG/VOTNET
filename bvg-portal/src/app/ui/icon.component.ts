import { Component, Input } from '@angular/core';

type IconName = 'plus' | 'refresh' | 'bug' | 'edit' | 'trash' | 'close' | 'info' | 'success' | 'warning' | 'error' | 'bell' | 'empty';

import { CommonModule } from '@angular/common';

@Component({
  selector: 'ui-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
  <svg [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <ng-container [ngSwitch]="name">
      <!-- plus -->
      <g *ngSwitchCase="'plus'"><path d="M12 5v14M5 12h14"/></g>
      <!-- refresh -->
      <g *ngSwitchCase="'refresh'"><path d="M3 12a9 9 0 0 1 15.3-6.3L21 8M21 8V3m0 5h-5"/><path d="M21 12a9 9 0 0 1-15.3 6.3L3 16M3 16v5m0-5h5"/></g>
      <!-- bug -->
      <g *ngSwitchCase="'bug'"><path d="M8 9h8m-4 0v10m7-7H5m12 6l2 2M5 18l-2 2M19 6l2-2M5 6L3 4"/><rect x="7" y="5" width="10" height="14" rx="5"/></g>
      <!-- edit -->
      <g *ngSwitchCase="'edit'"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/><path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></g>
      <!-- trash -->
      <g *ngSwitchCase="'trash'"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></g>
      <!-- close -->
      <g *ngSwitchCase="'close'"><path d="M6 6l12 12M18 6l-12 12"/></g>
      <!-- info -->
      <g *ngSwitchCase="'info'"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h2v5h-2z"/></g>
      <!-- success (check-circle) -->
      <g *ngSwitchCase="'success'"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></g>
      <!-- warning (triangle) -->
      <g *ngSwitchCase="'warning'"><path d="M12 3l10 18H2L12 3z"/><circle cx="12" cy="17" r="1" stroke-width="2"/><path d="M12 9v5"/></g>
      <!-- error (x-circle) -->
      <g *ngSwitchCase="'error'"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></g>
      <!-- bell -->
      <g *ngSwitchCase="'bell'"><path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M13.73 21a2 2 0 01-3.46 0"/></g>
      <!-- empty (box) -->
      <g *ngSwitchCase="'empty'"><path d="M21 16V8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.27 6.96L12 12l8.73-5.04"/></g>
      <!-- default fallback: info -->
      <g *ngSwitchDefault><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h2v5h-2z"/></g>
    </ng-container>
  </svg>
  `
})
export class UiIconComponent {
  @Input() name: IconName = 'info';
  @Input() size = 18;
}

