import { Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { MatStepperModule } from '@angular/material/stepper';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface User { id: string; userName: string; email: string; isActive: boolean; }

@Component({
  selector: 'app-election-wizard',
  standalone: true,
  imports: [ReactiveFormsModule, NgFor, NgIf, MatStepperModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatSelectModule, MatSnackBarModule],
  template: `
  <div class="page">
    <h2>Nueva elección (Wizard)</h2>
    <mat-horizontal-stepper [linear]="true">
      <!-- Paso 1: Datos básicos -->
      <mat-step [stepControl]="step1">
        <form [formGroup]="step1">
          <ng-template matStepLabel>Paso 1: Datos básicos</ng-template>
          <mat-form-field appearance="outline" class="full">
            <mat-label>Nombre</mat-label>
            <input matInput formControlName="name">
          </mat-form-field>
          <mat-form-field appearance="outline" class="full">
            <mat-label>Detalles</mat-label>
            <input matInput formControlName="details">
          </mat-form-field>
          <mat-form-field appearance="outline" class="full">
            <mat-label>Fecha y hora</mat-label>
            <input matInput type="datetime-local" formControlName="scheduledAt">
          </mat-form-field>
          <div>
            <button mat-raised-button color="primary" matStepperNext [disabled]="step1.invalid">Siguiente</button>
          </div>
        </form>
      </mat-step>

      <!-- Paso 2: Padrón + Quorum -->
      <mat-step>
        <ng-template matStepLabel>Paso 2: Quórum y padrón</ng-template>
        <div class="mb8">
          <a mat-stroked-button href="/api/elections/padron-template">Descargar plantilla Excel</a>
        </div>
        <input type="file" (change)="onPadron($event)" accept=".xlsx,.xls" />
        <mat-form-field appearance="outline" class="full">
          <mat-label>Quórum mínimo (0-1)</mat-label>
          <input matInput type="number" step="0.01" [formControl]="quorum">
        </mat-form-field>
        <div>
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
        <div>
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
  styles: [`.full{width:100%}.q-item{border-left:3px solid var(--bvg-blue);padding-left:8px;margin:8px 0}.op-item{display:flex;gap:8px;align-items:center}.options{margin:8px 0}.mb8{margin-bottom:8px}.assign-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}`]
})
export class ElectionWizardComponent {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  private snack = inject(MatSnackBar);

  step1 = this.fb.group({ name:['', Validators.required], details:[''], scheduledAt:['', Validators.required] });
  quorum = this.fb.nonNullable.control(0.5);
  questions = this.fb.array<FormGroup<any>>([]);
  padronFile: File | null = null;

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

  onPadron(e: Event){ const input = e.target as HTMLInputElement; this.padronFile = input.files?.[0] ?? null; }
  applyAttendance(){ const users = this.selectedUsersAttendance.value || []; if (!users.length) return; this.assignments.set([...this.assignments(), ...users.map(u=>({user:u, role:'ElectionRegistrar'}))]); this.selectedUsersAttendance.setValue([]); }
  applyVoting(){ const users = this.selectedUsersVoting.value || []; if (!users.length) return; this.assignments.set([...this.assignments(), ...users.map(u=>({user:u, role:'ElectionRegistrar'}))]); this.selectedUsersVoting.setValue([]); }
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
        quorumMinimo: this.quorum.value,
        questions: (this.questions.value||[]).map((q:any)=>({ text:q.text, options:q.options }))
      } as any;
      const created:any = await this.http.post('/api/elections', dto).toPromise();
      const id = created.id || created.Id || created?.e?.Id;
      if (!id) throw new Error('No se obtuvo ID');
      if (this.padronFile){ const fd = new FormData(); fd.append('file', this.padronFile); await this.http.post(`/api/elections/${id}/padron`, fd).toPromise(); }
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
