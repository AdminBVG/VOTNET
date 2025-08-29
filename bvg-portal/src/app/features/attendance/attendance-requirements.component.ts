import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NgIf, NgFor } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface PadronRow { id:string; shareholderId:string; shareholderName:string; legalRepresentative?:string; proxy?:string; shares:number; attendance:string; hasActa?: boolean }

@Component({
  selector: 'app-attendance-requirements',
  standalone: true,
  imports: [NgIf, NgFor, MatTableModule, MatButtonModule, MatSnackBarModule],
  template: `
  <div class="page">
    <h2>Requisitos</h2>
    <div class="badges" *ngIf="rows().length">
      <span class="chip" *ngIf="missing() > 0">Faltan {{missing()}} actas</span>
    </div>
    <div class="bar">
      <a mat-stroked-button href="/api/elections/padron-template" download>Descargar plantilla</a>
    </div>
    <table mat-table [dataSource]="rows()" class="mat-elevation-z1 compact" *ngIf="rows().length">
      <ng-container matColumnDef="id"><th mat-header-cell *matHeaderCellDef>ID</th><td mat-cell *matCellDef="let r">{{r.shareholderId}}</td></ng-container>
      <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>Accionista</th><td mat-cell *matCellDef="let r">{{r.shareholderName}}</td></ng-container>
      <ng-container matColumnDef="proxy"><th mat-header-cell *matHeaderCellDef>Apoderado</th><td mat-cell *matCellDef="let r">{{r.proxy || '-'}}</td></ng-container>
      <ng-container matColumnDef="has"><th mat-header-cell *matHeaderCellDef>Acta</th><td mat-cell *matCellDef="let r">{{ r.hasActa ? 'Sí' : 'No' }}</td></ng-container>
      <ng-container matColumnDef="acta"><th mat-header-cell *matHeaderCellDef>Acta</th><td mat-cell *matCellDef="let r">
        <ng-container *ngIf="r.proxy; else noProxy">
          <input type="file" accept="application/pdf" #f class="hidden" (change)="upload(r, f.files?.[0] || null)">
          <button mat-stroked-button (click)="f.click()">{{ r.hasActa ? 'Reemplazar PDF' : 'Subir PDF' }}</button>
          <a mat-button *ngIf="r.hasActa" [href]="docUrl(r)" target="_blank">Ver</a>
        </ng-container>
        <ng-template #noProxy>-</ng-template>
      </td></ng-container>
      <tr mat-header-row *matHeaderRowDef="cols"></tr>
      <tr mat-row *matRowDef="let row; columns: cols;"></tr>
    </table>
    <div *ngIf="!rows().length" class="muted">Sin padrón o sin permisos.</div>
  </div>
  `,
  styles: [`
    .page{ padding:16px }
    .bar{ margin-bottom:8px }
    .hidden{ display:none }
    table.compact th, table.compact td{ font-size:13px }
    .muted{ opacity:.75 }
  `]
})
export class AttendanceRequirementsComponent{
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private snack = inject(MatSnackBar);
  id = this.route.snapshot.params['id'];
  cols = ['id','name','proxy','has','acta'];
  rows = signal<PadronRow[]>([]);
  constructor(){ this.load(); }
  load(){ this.http.get<PadronRow[]>(`/api/elections/${this.id}/padron`).subscribe({ next: d=> this.rows.set(d||[]), error: _=> this.rows.set([]) }); }
  docUrl(r: PadronRow){ return `/uploads/elections/${this.id}/actas/${r.id}.pdf`; }
  upload(r: PadronRow, file: File | null){
    if (!file){ return; }
    if (file.type !== 'application/pdf' || file.size > 10*1024*1024){ this.snack.open('Solo PDF hasta 10MB','OK',{duration:2000}); return; }
    const fd = new FormData(); fd.append('file', file);
    this.http.post(`/api/elections/${this.id}/padron/${r.id}/acta`, fd).subscribe({
      next: _=> this.snack.open('Acta subida','OK',{duration:1500}),
      error: err=> this.snack.open('Error al subir acta','OK',{duration:2000})
    });
  }
  missing(){ return (this.rows()||[]).filter(r=> r.proxy && !r.hasActa).length; }
}
