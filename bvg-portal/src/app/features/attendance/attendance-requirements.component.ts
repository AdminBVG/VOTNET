import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LiveService } from '../../core/live.service';
import { NgIf, NgFor, NgStyle } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface PadronRow { id:string; shareholderId:string; shareholderName:string; legalRepresentative?:string; proxy?:string; shares:number; attendance:string; hasActa?: boolean }

@Component({
  selector: 'app-attendance-requirements',
  standalone: true,
  imports: [NgIf, NgFor, NgStyle, MatTableModule, MatButtonModule, MatSnackBarModule],
  template: `
  <div class="page">
    <h2>Requisitos</h2>
    <!-- Charts removidos en Requisitos por solicitud -->
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
      <ng-container matColumnDef="has"><th mat-header-cell *matHeaderCellDef>Acta</th><td mat-cell *matCellDef="let r">{{ r.hasActa ? 'SÃ­' : 'No' }}</td></ng-container>
      <ng-container matColumnDef="acta"><th mat-header-cell *matHeaderCellDef>Acta</th><td mat-cell *matCellDef="let r">
        <ng-container *ngIf="r.proxy; else noProxy">
          <input type="file" accept="application/pdf" #f class="hidden" (change)="upload(r, f.files?.[0] || null)">
          <button mat-stroked-button (click)="f.click()">{{ r.hasActa ? 'Reemplazar PDF' : 'Subir PDF' }}</button>
          <button mat-button *ngIf="r.hasActa" (click)="view(r)">Ver</button>
        </ng-container>
        <ng-template #noProxy>-</ng-template>
      </td></ng-container>
      <tr mat-header-row *matHeaderRowDef="cols"></tr>
      <tr mat-row *matRowDef="let row; columns: cols;"></tr>
    </table>
    <div *ngIf="!rows().length" class="muted">Sin padrÃ³n o sin permisos.</div>
  </div>
  `,
  styles: [`
    .page{ padding:16px }
    .charts{ display:flex; align-items:center; gap:16px; margin-bottom:8px }
    .donut{ width:140px; height:140px; border-radius:50%; position:relative; background:#eee }
    .donut .hole{ position:absolute; inset:18px; background:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center }
    .donut .center{ text-align:center; line-height:1 }
    .donut .num{ font-size:20px; font-weight:600 }
    .donut .sub{ font-size:11px; opacity:.75 }
    .legend{ display:flex; gap:12px; flex-wrap:wrap; font-size:13px; opacity:.95 }
    .legend .box{ display:inline-block; width:12px; height:12px; border-radius:3px; margin-right:6px }
    .legend .presencial{ background:#2e7d32 }
    .legend .virtual{ background:#1565c0 }
    .legend .ausente{ background:#9e9e9e }
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
  private live = inject(LiveService);
  id = this.route.snapshot.params['id'];
  cols = ['id','name','proxy','has','acta'];
  rows = signal<PadronRow[]>([]);
  constructor(){
    this.load();
    // Live updates: acta uploaded and attendance changes
    this.live.onActaUploaded(p => {
      if (p && p.ElectionId === this.id){
        const r = this.rows().find(x => x.id === p.PadronId);
        if (r) r.hasActa = true;
      }
    });
    this.live.onAttendanceUpdated(p => {
      if (p && p.ElectionId === this.id){
        const r = this.rows().find(x => x.id === p.PadronId);
        if (r) r.attendance = p.Attendance as any;
      }
    });
  }
  load(){ 
    this.http.get<PadronRow[]>(`/api/elections/${this.id}/padron`).subscribe({ 
      next: d=> {
        // Ordenar por ID de accionista numéricamente
        const sortedData = (d || []).sort((a, b) => {
          const aNum = parseInt(a.shareholderId) || 0;
          const bNum = parseInt(b.shareholderId) || 0;
          return aNum - bNum;
        });
        this.rows.set(sortedData);
      }, 
      error: _=> this.rows.set([]) 
    }); 
  }
  presentCount(){ return this.rows().filter(r=>r.attendance==='Presencial').length; }
  virtualCount(){ return this.rows().filter(r=>r.attendance==='Virtual').length; }
  absentCount(){ return this.rows().filter(r=>r.attendance==='None').length; }
  chartStyle(){
    const total = this.rows().length || 1;
    const p = Math.round(this.presentCount()/total*100);
    const v = Math.round(this.virtualCount()/total*100);
    const g = `conic-gradient(#2e7d32 0 ${p}%, #1565c0 ${p}% ${p+v}%, #9e9e9e ${p+v}% 100%)`;
    return { background: g } as any;
  }
  view(r: PadronRow){
    this.http.get(`/api/elections/${this.id}/padron/${r.id}/acta`, { responseType: 'blob' as 'json' }).subscribe({
      next: (data:any) => { const blob = data as Blob; const url = URL.createObjectURL(blob); window.open(url, '_blank'); setTimeout(()=> URL.revokeObjectURL(url), 15000); },
      error: _ => this.snack.open('No se pudo abrir el PDF','OK',{duration:2000})
    });
  }
  upload(r: PadronRow, file: File | null){
    if (!file){ return; }
    if (file.type !== 'application/pdf' || file.size > 10*1024*1024){ this.snack.open('Solo PDF hasta 10MB','OK',{duration:2000}); return; }
    const fd = new FormData(); fd.append('file', file);
    this.http.post(`/api/elections/${this.id}/padron/${r.id}/acta`, fd).subscribe({
      next: _=> { r.hasActa = true; this.snack.open('Acta subida','OK',{duration:1500}); },
      error: err=> this.snack.open('Error al subir acta','OK',{duration:2000})
    });
  }
  missing(){ return (this.rows()||[]).filter(r=> r.proxy && !r.hasActa).length; }
}
