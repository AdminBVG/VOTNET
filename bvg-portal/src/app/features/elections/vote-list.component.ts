import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Roles } from '../../core/constants/roles';

interface AssignedDto { id: string; name: string; scheduledAt: string; isClosed: boolean; }

@Component({
  selector: 'app-vote-list',
  standalone: true,
  imports: [NgIf, NgFor, DatePipe, MatCardModule, MatButtonModule, MatSnackBarModule],
  template: `
  <div class="page">
    <h2>Elecciones asignadas</h2>
    <div *ngIf="!items().length" class="muted">No tienes elecciones asignadas.</div>
    <div class="grid">
      <mat-card *ngFor="let e of items()" class="mat-elevation-z1">
        <h3>{{e.name}}</h3>
        <div class="meta">{{e.scheduledAt | date:'medium'}} <span *ngIf="e.isClosed" class="chip">Cerrada</span></div>
        <div class="actions">
          <button mat-raised-button color="primary" (click)="start(e.id)" [disabled]="e.isClosed">Empezar elecciÃ³n</button>
        </div>
      </mat-card>
    </div>
  </div>
  `,
  styles: [`
    .page{ padding:16px }
    .grid{ display:grid; grid-template-columns: repeat(auto-fit, minmax(260px,1fr)); gap:12px }
    .actions{ display:flex; gap:8px; margin-top:8px }
    .meta{ opacity:.85; font-size:13px }
    .chip{ background:#eee; border-radius:12px; padding:2px 8px; font-size:12px; margin-left:6px }
    .muted{ opacity:.75 }
  `]
})
export class VoteListComponent {
  private http = inject(HttpClient);
  private router = inject(Router);
  private snack = inject(MatSnackBar);
  items = signal<AssignedDto[]>([]);
  constructor(){ this.load(); }
  load(){
    this.http.get<AssignedDto[]>(`/api/elections/assigned?role=${Roles.VoteRegistrar}`).subscribe({ next: d=> this.items.set(d||[]), error: _=> this.items.set([]) });
  }
  start(id: string){`r`n    this.http.get<any>(`/api/elections/${id}/status`).subscribe({`r`n      next: s => { const st = (s?.Status ?? s?.status ?? "Draft"); if (st !== "VotingOpen") { this.snack.open("La votación no está abierta","OK",{duration:2000}); return; } this.router.navigate(["/elections", id]); },`r`n      error: _=> this.snack.open("No se pudo comprobar el estado","OK",{duration:2000})`r`n    });`r`n  }/status`).subscribe({\r\n      next: s => { const st = (s?.Status ?? s?.status ?? "Draft"); if (st !== "VotingOpen") { alert("La votación no está abierta"); return; } this.router.navigate(["/elections", id]); },\r\n      error: _=> alert("No se pudo comprobar estado de la elección")\r\n    });\r\n  }/start`, {}).subscribe({
      next: _=> this.router.navigate(['/elections', id]),
      error: _=> this.router.navigate(['/elections', id])
    });
  }
}

