import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LiveService } from '../../core/live.service';
import { NgIf, NgFor, NgStyle } from '@angular/common';
import { UiButtonDirective } from '../../ui/button.directive';
import { ToastService } from '../../ui/toast/toast.service';

interface PadronRow { id:string; shareholderId:string; shareholderName:string; legalRepresentative?:string; proxy?:string; shares:number; attendance:string; hasActa?: boolean }

@Component({
  selector: 'app-attendance-requirements',
  standalone: true,
  imports: [NgIf, NgFor, NgStyle, UiButtonDirective],
  template: `
  <div class="p-4">
    <h2 class="text-xl font-semibold mb-2">Requisitos</h2>
    <div class="mb-2" *ngIf="rows().length">
      <span class="rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-800" *ngIf="missing() > 0">Faltan {{missing()}} actas</span>
    </div>
    <div class="mb-2">
      <a class="underline text-brand-primary" href="/api/elections/padron-template" download>Descargar plantilla</a>
    </div>
    <table class="table-base table-compact thead-sticky row-zebra" *ngIf="rows().length">
      <thead>
        <tr>
          <th class="text-left p-2">ID</th>
          <th class="text-left p-2">Accionista</th>
          <th class="text-left p-2">Apoderado</th>
          <th class="text-left p-2">Acta</th>
          <th class="text-left p-2">AcciÃ³n</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let r of rows()" class="border-t">
          <td class="p-2">{{r.shareholderId}}</td>
          <td class="p-2">{{r.shareholderName}}</td>
          <td class="p-2">{{r.proxy || '-'}}</td>
          <td class="p-2">{{ r.hasActa ? 'SÃ­' : 'No' }}</td>
          <td class="p-2">
            <ng-container *ngIf="r.proxy; else noProxy">
              <input type="file" accept="application/pdf" #f class="hidden" (change)="upload(r, f.files?.[0] || null)">
              <button uiBtn="secondary" (click)="f.click()">{{ r.hasActa ? 'Reemplazar PDF' : 'Subir PDF' }}</button>
              <button uiBtn="link" *ngIf="r.hasActa" (click)="view(r)">Ver</button>
            </ng-container>
            <ng-template #noProxy>-</ng-template>
          </td>
        </tr>
      </tbody>
    </table>
    <div *ngIf="!rows().length" class="opacity-75">Sin padrÃ³n o sin permisos.</div>
  </div>
  `
})
export class AttendanceRequirementsComponent{
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private live = inject(LiveService);
  id = this.route.snapshot.params['id'];
  cols = ['id','name','proxy','has','acta'];
  rows = signal<PadronRow[]>([]);
  constructor(){
    this.load();
    this.live.joinElection(this.id);
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
  ngOnDestroy(){ this.live.leaveElection(this.id); }
  load(){ 
    this.http.get<PadronRow[]>(`/api/elections/${this.id}/padron`).subscribe({ 
      next: d=> { const sorted = (d||[]).sort((a,b)=> (parseInt(a.shareholderId)||0)-(parseInt(b.shareholderId)||0)); this.rows.set(sorted); }, 
      error: _=> this.rows.set([]) 
    }); 
  }
  view(r: PadronRow){
    this.http.get(`/api/elections/${this.id}/padron/${r.id}/acta`, { responseType: 'blob' as 'json' }).subscribe({
      next: (data:any) => { const blob = data as Blob; const url = URL.createObjectURL(blob); window.open(url, '_blank'); setTimeout(()=> URL.revokeObjectURL(url), 15000); },
      error: _ => this.toast.show('No se pudo abrir el PDF','error',2000)
    });
  }
  upload(r: PadronRow, file: File | null){
    if (!file){ return; }
    if (file.type !== 'application/pdf' || file.size > 10*1024*1024){ this.toast.show('Solo PDF hasta 10MB','warning',2000); return; }
    const fd = new FormData(); fd.append('file', file);
    this.http.post(`/api/elections/${this.id}/padron/${r.id}/acta`, fd).subscribe({
      next: _=> { r.hasActa = true; this.toast.show('Acta subida','success',1500); },
      error: _=> this.toast.show('Error al subir acta','error',2000)
    });
  }
  missing(){ return (this.rows()||[]).filter(r=> r.proxy && !r.hasActa).length; }
}



