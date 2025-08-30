import { Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { NgFor, NgIf, DecimalPipe } from '@angular/common';
import { MatStepperModule } from '@angular/material/stepper';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import * as XLSX from 'xlsx';

interface User { id: string; userName: string; email: string; isActive: boolean; }

@Component({
  selector: 'app-election-wizard',
  standalone: true,
  imports: [ReactiveFormsModule, NgFor, NgIf, DecimalPipe, MatStepperModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatSelectModule, MatSnackBarModule, MatDatepickerModule, MatNativeDateModule],
  template: `
  <div class="page">
    <h2>Nueva elección</h2>
    <mat-horizontal-stepper [linear]="true">
      <!-- Paso 1: Datos básicos -->
      <mat-step [stepControl]="step1">
        <form [formGroup]="step1">
          <ng-template matStepLabel>Paso 1: Datos básicos</ng-template>
          <div class="step-pad">
            <mat-form-field appearance="outline" class="full">
              <mat-label>Nombre</mat-label>
              <input matInput formControlName="name">
            </mat-form-field>
            <mat-form-field appearance="outline" class="full">
              <mat-label>Detalles</mat-label>
              <input matInput formControlName="details">
            </mat-form-field>
            <div class="row">
              <mat-form-field appearance="outline" class="half">
                <mat-label>Fecha</mat-label>
                <input matInput [matDatepicker]="picker" [value]="getDate()" (dateChange)="onDateChange($event.value)">
                <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
                <mat-datepicker #picker></mat-datepicker>
              </mat-form-field>
              <mat-form-field appearance="outline" class="half">
                <mat-label>Hora</mat-label>
                <input matInput type="time" [value]="getTime()" (input)="onTimeChange($any($event.target).value)">
              </mat-form-field>
            </div>
          </div>
          <div>
            <button mat-raised-button color="primary" matStepperNext [disabled]="step1.invalid">Siguiente</button>
          </div>
        </form>
      </mat-step>

      <!-- Paso 2: Padrón + Quorum -->
      <mat-step>
        <ng-template matStepLabel>Paso 2: Quórum y padrón</ng-template>
        <div class="upload-row">
          <div class="upload">
          <a mat-stroked-button color="primary" href="/api/elections/padron-template" download>Descargar plantilla Excel</a>
          <input type="file" #padronInput class="hidden" (change)="onPadron($event)" accept=".xlsx,.xls" />
          <button mat-stroked-button color="primary" type="button" (click)="padronInput.click()">Subir padrón</button>
          <span class="file" *ngIf="padronFile">{{ padronFile.name }} ({{ (padronFile.size/1024) | number:'1.0-0' }} KB)</span>
          </div>
          <mat-form-field appearance="outline" class="quorum">
            <mat-label>Quórum mínimo (%)</mat-label>
            <input matInput type="number" step="1" min="0" max="100" [formControl]="quorum">
          </mat-form-field>
        </div>
        <div class="preview" *ngIf="previewRows().length">
          <h4>Vista previa del padrón (primeras {{ previewRows().length }} filas)</h4>
          <div class="table-wrap">
            <table class="mat-elevation-z1">
              <thead>
                <tr>
                  <th *ngFor="let h of previewHeaders()">{{h}}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let r of previewRows()">
                  <td *ngFor="let c of r">{{c}}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="step-actions">
          <button mat-button matStepperPrevious>Anterior</button>
          <button mat-raised-button color="primary" matStepperNext>Siguiente</button>
        </div>
      </mat-step>

      <!-- Paso 3: Preguntas -->
      <mat-step>
        <ng-template matStepLabel>Paso 3: Preguntas</ng-template>
        <div *ngFor="let q of questions.controls; let i=index" [formGroup]="q" class="q-item">
          <mat-form-field class="full" appearance="outline">
            <mat-label>Pregunta</mat-label>
            <input matInput formControlName="text">
          </mat-form-field>
          <div class="options">
            <div *ngFor="let op of ($any(q.get('options')).controls); let j=index" class="op-item">
              <mat-form-field appearance="outline">
                <mat-label>Opción</mat-label>
                <input matInput [formControl]="op">
              </mat-form-field>
              <button mat-button color="warn" type="button" (click)="removeOption(i,j)">Quitar</button>
            </div>
            <button mat-button type="button" (click)="addOption(i)">Agregar opción</button>
          </div>
          <button mat-button color="warn" type="button" (click)="removeQuestion(i)">Quitar pregunta</button>
        </div>
        <button mat-stroked-button type="button" (click)="addQuestion()">Agregar pregunta</button>
        <div class="step-actions">
          <button mat-button matStepperPrevious>Anterior</button>
          <button mat-raised-button color="primary" matStepperNext>Siguiente</button>
        </div>
      </mat-step>

      <!-- Paso 4: Asignaciones -->
      <mat-step>
        <ng-template matStepLabel>Paso 4: Asignaciones</ng-template>
        <div class="mb8">
          <div class="assign-cols">
            <div>
              <h4>Registradores de asistencia</h4>
              <mat-form-field appearance="outline" class="full">
                <mat-label>Usuarios</mat-label>
                <mat-select multiple [formControl]="selectedUsersAttendance">
                  <mat-option *ngFor="let u of users()" [value]="u">{{u.userName}} ({{u.email}})</mat-option>
                </mat-select>
              </mat-form-field>
              <button mat-stroked-button type="button" (click)="applyAttendance()">Asignar asistencia</button>
            </div>
            <div>
              <h4>Registradores de votación</h4>
              <mat-form-field appearance="outline" class="full">
                <mat-label>Usuarios</mat-label>
                <mat-select multiple [formControl]="selectedUsersVoting">
                  <mat-option *ngFor="let u of users()" [value]="u">{{u.userName}} ({{u.email}})</mat-option>
                </mat-select>
              </mat-form-field>
              <button mat-stroked-button type="button" (click)="applyVoting()">Asignar votación</button>
            </div>
          </div>
        </div>
        <div *ngIf="assignments().length">
          <h4>Asignaciones</h4>
          <ul>
            <li *ngFor="let a of assignments(); let i=index">{{a.user.userName}} - {{a.role}} <button mat-button color="warn" (click)="removeAssignment(i)">Quitar</button></li>
          </ul>
        </div>
        <div>
          <button mat-button matStepperPrevious>Anterior</button>
          <button mat-raised-button color="primary" matStepperNext>Siguiente</button>
        </div>
      </mat-step>

      <!-- Paso 5: Resumen y crear -->
      <mat-step>
        <ng-template matStepLabel>Paso 5: Resumen</ng-template>
        <p>Revisa los datos y crea la elección.</p>
        <button mat-raised-button color="primary" (click)="create()" [disabled]="creating()">Crear elección</button>
      </mat-step>
    </mat-horizontal-stepper>
  </div>
  `,
  styles: [`.full{width:100%}
    .row{display:flex; gap:12px; flex-wrap:wrap}
    .half{flex:1 1 240px}
    .step-pad{margin-top:12px}
    .upload-row{display:flex; align-items:center; gap:12px; width:100%; margin-bottom:10px}
    .upload-row .upload{display:flex; align-items:center; gap:12px; flex-wrap:wrap; flex:1}
    .upload-row .quorum{margin-left:auto; width:200px; min-width:180px; align-self:center; margin-right:12px}
    @media (max-width: 800px){ .upload-row{flex-wrap:wrap} .upload-row .quorum{margin-left:0; width:100%; margin-right:0} }
    .q-item{border-left:3px solid var(--bvg-blue);padding-left:8px;margin:8px 0}
    .op-item{display:flex;gap:8px;align-items:center}
    .options{margin:8px 0}
    .mb8{margin-bottom:8px}
    .assign-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
    .upload{display:flex; align-items:center; gap:12px}
    .hidden{display:none}
    .file{opacity:.85}
    .preview{margin-top:12px}
    .table-wrap{overflow:auto; max-height:280px; border:1px solid rgba(0,0,0,.06); border-radius:6px}
    table{width:100%; border-collapse:collapse}
    thead th{position:sticky; top:0; background:#f4f7fb; font-weight:600; font-size:12px; letter-spacing:.3px}
    th, td{padding:8px 10px; border-bottom:1px solid rgba(0,0,0,.06); white-space:nowrap}
    .step-actions{ margin-top:12px }
  `]
})
export class ElectionWizardComponent {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  private snack = inject(MatSnackBar);

  step1 = this.fb.group({ name:['', Validators.required], details:[''], scheduledAt:['', Validators.required] });
  quorum = this.fb.nonNullable.control(50);
  questions = this.fb.array<FormGroup<any>>([]);
  padronFile: File | null = null;
  private selDate = signal<Date | null>(new Date());
  private selTime = signal<string>('09:00');
  previewHeaders = signal<string[]>([]);
  previewRows = signal<any[][]>([]);

  users = signal<User[]>([]);
  selectedUsersAttendance = this.fb.control<User[]>([]);
  selectedUsersVoting = this.fb.control<User[]>([]);
  assignments = signal<{user: User, role: string}[]>([]);
  creating = signal(false);

  functionalRoles = ['ElectionObserver','ElectionRegistrar','ElectionVoter'];

  constructor(){
    this.http.get<User[]>(`/api/users`).subscribe({ next: d => this.users.set(d), error: _=> this.users.set([]) });
  }

  addQuestion(){ this.questions.push(this.fb.group({ text: ['', Validators.required], options: this.fb.array<FormControl<string>>([this.fb.nonNullable.control('Sí'), this.fb.nonNullable.control('No')]) })); }
  removeQuestion(i:number){ this.questions.removeAt(i); }
  addOption(i:number){ (this.questions.at(i).get('options') as FormArray<FormControl<string>>).push(this.fb.nonNullable.control('')); }
  removeOption(i:number,j:number){ (this.questions.at(i).get('options') as FormArray).removeAt(j); }

  onPadron(e: Event){
    const input = e.target as HTMLInputElement;
    this.padronFile = input.files?.[0] ?? null;
    this.previewHeaders.set([]); this.previewRows.set([]);
    if (!this.padronFile) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (!rows || !rows.length) return;
        const headers = (rows[0] as any[]).map(x => String(x||''));
        const body = rows.slice(1).filter(r => r && r.length).slice(0, 20);
        this.previewHeaders.set(headers);
        this.previewRows.set(body.map(r => headers.map((_,i)=> r[i] ?? '')));
      } catch { /* ignore preview errors */ }
    };
    reader.readAsArrayBuffer(this.padronFile);
  }
  onDateChange(d: Date | null){ this.selDate.set(d); this.composeDateTime(); }
  onTimeChange(t: string){ this.selTime.set(t || '09:00'); this.composeDateTime(); }
  getDate(){ return this.selDate(); }
  getTime(){ return this.selTime(); }
  private composeDateTime(){
    const d = this.selDate(); if (!d) return;
    const [h,m] = (this.selTime()||'09:00').split(':').map(x=>parseInt(x,10));
    const out = new Date(d); out.setHours(h||0, m||0, 0, 0);
    this.step1.patchValue({ scheduledAt: out.toISOString() });
  }
  applyAttendance(){ const users = this.selectedUsersAttendance.value || []; if (!users.length) return; this.assignments.set([...this.assignments(), ...users.map(u=>({user:u, role:'ElectionRegistrar'}))]); this.selectedUsersAttendance.setValue([]); }
  applyVoting(){ const users = this.selectedUsersVoting.value || []; if (!users.length) return; this.assignments.set([...this.assignments(), ...users.map(u=>({user:u, role:'VoteOperator'}))]); this.selectedUsersVoting.setValue([]); }
  removeAssignment(i:number){ const copy = [...this.assignments()]; copy.splice(i,1); this.assignments.set(copy); }

  async create(){
    if (this.step1.invalid) return;
    this.creating.set(true);
    try {
      const v = this.step1.value;
      const dto = {
        name: v.name,
        details: v.details,
        scheduledAt: v.scheduledAt,
        quorumMinimo: (this.quorum.value || 0) > 1 ? Math.min(1, Math.max(0, (this.quorum.value as number) / 100)) : (this.quorum.value || 0),
        questions: (this.questions.value||[]).map((q:any)=>({ text:q.text, options:q.options }))
      } as any;
      const created:any = await this.http.post('/api/elections', dto).toPromise();
      const id = created.id || created.Id || created?.e?.Id;
      if (!id) throw new Error('No se obtuvo ID');
      if (this.padronFile){
        const fd = new FormData(); fd.append('file', this.padronFile);
        try { await this.http.post(`/api/elections/${id}/padron`, fd).toPromise(); }
        catch { this.snack.open('Error al subir padrón','OK',{duration:2500}); }
      }
      for (const a of this.assignments()){
        await this.http.post(`/api/elections/${id}/assignments`, { userId: a.user.id, role: a.role }).toPromise();
      }
      this.snack.open('Elección creada','OK',{duration:2000});
      this.router.navigate(['/elections', id]);
    } catch (e){
      this.snack.open('Error al crear elección','OK',{duration:3000});
    } finally {
      this.creating.set(false);
    }
  }
}
