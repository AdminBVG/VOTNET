import { Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { NgFor, NgIf, DecimalPipe, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiButtonDirective } from '../../ui/button.directive';
import { UiInputDirective } from '../../ui/input.directive';
import { UiSelectComponent } from '../../ui/select/select.component';
import { ToastService } from '../../ui/toast/toast.service';
import * as XLSX from 'xlsx';

interface User { id: string; userName: string; email: string; isActive: boolean; }

@Component({
  selector: 'app-election-wizard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, NgFor, NgIf, DecimalPipe, UiButtonDirective, UiInputDirective, UiSelectComponent],
  template: `
  <div class="p-4">
    <h2 class="text-xl font-semibold mb-3">Nueva elección</h2>
    <div class="rounded-2xl border border-gray-200 bg-white shadow-card p-4">
      <div class="flex items-center gap-2 mb-3">
        <div class="px-2 py-1 rounded bg-brand-primary text-white" *ngFor="let s of [1,2,3,4,5]; let i=index" [class.opacity-60]="step!==s">Paso {{s}}</div>
      </div>
      <ng-container [ngSwitch]="step">
        <form *ngSwitchCase="1" [formGroup]="step1" (ngSubmit)="go(2)" class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
          <div class="col-span-full"><label class="field-label">Nombre</label><input uiInput formControlName="name"></div>
          <div class="col-span-full"><label class="field-label">Detalles</label><input uiInput formControlName="details"></div>
          <div><label class="field-label">Fecha</label><input uiInput type="date" [value]="getDate() | date:'yyyy-MM-dd'" (change)="onDateChange($any($event.target).valueAsDate || null)"></div>
          <div><label class="field-label">Hora</label><input uiInput type="time" [value]="getTime()" (input)="onTimeChange($any($event.target).value)"></div>
          <div class="col-span-full flex gap-2 justify-end"><button uiBtn="secondary" type="button" (click)="cancel()">Cancelar</button><button uiBtn="primary" [disabled]="step1.invalid">Siguiente</button></div>
        </form>
        <div *ngSwitchCase="2">
          <div class="flex items-center gap-2 mb-2">
            <a uiBtn="secondary" href="/api/elections/padron-template" download>Descargar plantilla Excel</a>
            <input type="file" #padronInput class="hidden" (change)="onPadron($event)" accept=".xlsx,.xls" />
            <button uiBtn="secondary" type="button" (click)="padronInput.click()">Subir padrón</button>
            <span class="file" *ngIf="padronFile">{{ padronFile.name }} ({{ (padronFile.size/1024) | number:'1.0-0' }} KB)</span>
            <div class="ml-auto w-52"><label class="field-label">Quórum mínimo (%)</label><input uiInput type="number" step="1" min="0" max="100" [formControl]="quorum"></div>
          </div>
          <div class="preview" *ngIf="previewRows().length">
            <h4 class="font-semibold">Vista previa del padrón (primeras {{ previewRows().length }} filas)</h4>
            <div class="table-wrap">
              <table class="table-base table-compact thead-sticky row-zebra">
                <thead><tr><th *ngFor="let h of previewHeaders()" class="p-2 text-left">{{h}}</th></tr></thead>
                <tbody>
                  <tr *ngFor="let r of previewRows()" class="border-t"><td *ngFor="let c of r" class="p-2">{{c}}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="flex gap-2 justify-between mt-2"><button uiBtn="secondary" (click)="go(1)">Anterior</button><button uiBtn="primary" (click)="go(3)">Siguiente</button></div>
        </div>
        <div *ngSwitchCase="3">
          <div *ngFor="let q of questions.controls; let i=index" [formGroup]="q" class="border-l-4 border-brand-primary pl-2 my-2">
            <label class="field-label">Pregunta</label>
            <input uiInput formControlName="text" class="mb-1">
            <div class="options">
              <div *ngFor="let op of ($any(q.get('options')).controls); let j=index" class="flex items-center gap-2 my-1">
                <input uiInput [formControl]="op" placeholder="Opción">
                <button uiBtn="danger" type="button" (click)="removeOption(i,j)">Quitar</button>
              </div>
              <button uiBtn="secondary" type="button" (click)="addOption(i)">Agregar opción</button>
            </div>
            <button uiBtn="danger" type="button" (click)="removeQuestion(i)">Quitar pregunta</button>
          </div>
          <button uiBtn="secondary" type="button" (click)="addQuestion()">Agregar pregunta</button>
          <div class="flex gap-2 justify-between mt-2"><button uiBtn="secondary" (click)="go(2)">Anterior</button><button uiBtn="primary" (click)="go(4)">Siguiente</button></div>
        </div>
        <div *ngSwitchCase="4" class="grid gap-2">
          <h4 class="font-semibold">Asignaciones (ingresa IDs separados por coma)</h4>
          <label class="field-label">Registradores de asistencia</label>
          <input uiInput [(ngModel)]="attendanceIds" [ngModelOptions]="{standalone:true}" placeholder="userId1,userId2">
          <div class="flex items-center gap-2">
            <ui-select class="w-72" [options]="userOptions()" [searchable]="true" [(ngModel)]="attSelection" [ngModelOptions]="{standalone:true}" (ngModelChange)="appendAtt($event)"></ui-select>
            <span class="text-xs text-muted">Agregar usuario a la lista</span>
          </div>
          <label class="field-label">Registradores de votación</label>
          <input uiInput [(ngModel)]="votingIds" [ngModelOptions]="{standalone:true}" placeholder="userId3,userId4">
          <div class="flex items-center gap-2">
            <ui-select class="w-72" [options]="userOptions()" [searchable]="true" [(ngModel)]="votSelection" [ngModelOptions]="{standalone:true}" (ngModelChange)="appendVot($event)"></ui-select>
            <span class="text-xs text-muted">Agregar usuario a la lista</span>
          </div>
          <div class="flex gap-2 justify-between mt-2"><button uiBtn="secondary" (click)="go(3)">Anterior</button><button uiBtn="primary" (click)="go(5)">Siguiente</button></div>
        </div>
        <div *ngSwitchCase="5">
          <h4 class="font-semibold">Resumen</h4>
          <div class="mb-2">Se creará la elección con {{questions.length}} pregunta(s), quórum {{quorum.value}}%.</div>
          <button uiBtn="primary" (click)="create()" [disabled]="creating()">Crear elección</button>
          <button uiBtn="secondary" class="ml-2" (click)="go(4)">Anterior</button>
        </div>
      </ng-container>
    </div>
  </div>
  `,
  styles: [`
    .table-wrap{overflow:auto; max-height:280px; border:1px solid rgba(0,0,0,.06); border-radius:6px}
  `]
})
export class ElectionWizardComponent {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  private toast = inject(ToastService);

  step = 1;
  creating = signal(false);
  padronFile: File | null = null;
  quorum = new FormControl<number>(50, { nonNullable: true });

  step1 = this.fb.group({ name: ['', Validators.required], details: [''] });
  questions = new FormArray<FormGroup<any>>([]);

  attendanceIds = '';
  votingIds = '';
  attSelection: string = '';
  votSelection: string = '';
  allUsers = signal<User[]>([]);

  constructor(){
    this.http.get<User[]>(`/api/users`).subscribe({ next: d => this.allUsers.set(d||[]), error: _ => this.allUsers.set([]) });
  }

  getDate(){ return new Date(); }
  getTime(){ const d=new Date(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
  onDateChange(_d: Date | null){}
  onTimeChange(_v: string){}

  addQuestion(){ this.questions.push(this.fb.group({ text: ['', Validators.required], options: this.fb.array([new FormControl('Sí'), new FormControl('No')]) })); }
  removeQuestion(i: number){ this.questions.removeAt(i); }
  addOption(i: number){ const group = this.questions.at(i) as FormGroup; (group.get('options') as FormArray).push(new FormControl('')); }
  removeOption(i: number, j: number){ const group = this.questions.at(i) as FormGroup; (group.get('options') as FormArray).removeAt(j); }

  onPadron(e: Event){ const input = e.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return; this.padronFile = file; this.previewPadron(file); }
  previewHeaders = signal<string[]>([]);
  previewRows = signal<any[][]>([]);
  previewPadron(file: File){ const reader = new FileReader(); reader.onload = () => { const data = new Uint8Array(reader.result as ArrayBuffer); const wb = XLSX.read(data, { type: 'array' }); const ws = wb.Sheets[wb.SheetNames[0]]; const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]; const headers = (json[0] || []).map((h:any)=> String(h)); this.previewHeaders.set(headers); this.previewRows.set((json.slice(1, 16) || [])); }; reader.readAsArrayBuffer(file); }

  go(s: number){ this.step = s; }
  cancel(){ this.router.navigate(['/elections']); }

  userOptions(){ return (this.allUsers()||[]).map(u => ({ label: `${u.userName} (${u.email})`, value: u.id })); }
  appendAtt(id: string){ if(!id) return; const parts = (this.attendanceIds||'').split(',').map(s=>s.trim()).filter(Boolean); if(!parts.includes(id)) parts.push(id); this.attendanceIds = parts.join(','); this.attSelection = ''; }
  appendVot(id: string){ if(!id) return; const parts = (this.votingIds||'').split(',').map(s=>s.trim()).filter(Boolean); if(!parts.includes(id)) parts.push(id); this.votSelection = ''; }

  async create(){
    if (this.step1.invalid){ this.toast.show('Completa los datos básicos','warning',2000); this.step = 1; return; }
    this.creating.set(true);
    try{
      const scheduledAt = new Date();
      const dto = {
        name: this.step1.value.name!,
        details: this.step1.value.details || '',
        scheduledAt: scheduledAt.toISOString(),
        quorumMinimo: Math.min(1, Math.max(0, (this.quorum.value||0)/100)),
        questions: this.questions.controls.map((q:any)=> ({ text:q.value.text, options: (q.value.options||[]).map((x:any)=> String(x||'')) }))
      };
      const res:any = await this.http.post('/api/elections', dto).toPromise();
      const id = res?.id || res?.Id;
      if (this.padronFile){ const fd = new FormData(); fd.append('file', this.padronFile); await this.http.post(`/api/elections/${id}/padron`, fd).toPromise(); }
      const att = (this.attendanceIds||'').split(',').map(s=>s.trim()).filter(Boolean);
      const vot = (this.votingIds||'').split(',').map(s=>s.trim()).filter(Boolean);
      for (const u of att){ await this.http.post(`/api/elections/${id}/assignments`, { userId: u, role: 'AttendanceRegistrar' }).toPromise(); }
      for (const u of vot){ await this.http.post(`/api/elections/${id}/assignments`, { userId: u, role: 'VoteRegistrar' }).toPromise(); }
      this.toast.show('Elección creada','success',2000);
      // Redirigir al historial de elecciones para administración
      this.router.navigate(['/elections']);
    } catch {
      this.toast.show('Error al crear elección','error',2500);
    } finally { this.creating.set(false); }
  }
}
