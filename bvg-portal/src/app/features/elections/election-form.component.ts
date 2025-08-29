import { Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { NgFor, NgIf } from '@angular/common';

@Component({
  selector: 'app-election-form',
  standalone: true,
  imports: [ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatDatepickerModule, MatNativeDateModule, NgFor, NgIf],
  template: `
  <mat-card>
    <h3>Nueva elección</h3>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-form-field class="full" appearance="outline">
        <mat-label>Nombre</mat-label>
        <input matInput formControlName="name">
      </mat-form-field>
      <mat-form-field class="full" appearance="outline">
        <mat-label>Detalles</mat-label>
        <input matInput formControlName="details">
      </mat-form-field>
      <mat-form-field class="full" appearance="outline">
        <mat-label>Fecha</mat-label>
        <input matInput [matDatepicker]="picker" formControlName="scheduledAt">
        <mat-datepicker #picker></mat-datepicker>
      </mat-form-field>
      <mat-form-field class="full" appearance="outline">
        <mat-label>Quorum mínimo (0-1)</mat-label>
        <input matInput type="number" step="0.01" formControlName="quorumMinimo">
      </mat-form-field>

      <div class="q-section">
        <h4>Preguntas</h4>
        <div *ngFor="let q of questions.controls; let i=index" [formGroup]="q" class="q-item">
          <mat-form-field class="full" appearance="outline">
            <mat-label>Texto de la pregunta</mat-label>
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
        <button mat-raised-button color="primary" type="button" (click)="addQuestion()">Agregar pregunta</button>
      </div>

      <button mat-raised-button color="primary" [disabled]="form.invalid || loading()">Crear</button>
      <span *ngIf="ok()" style="color:green; margin-left:8px">Creada</span>
    </form>
  </mat-card>
  `,
  styles: [`.full{width:100%} .q-item{border-left:3px solid var(--bvg-blue); padding-left:8px; margin:8px 0} .op-item{display:flex; gap:8px; align-items:center} .options{margin:8px 0}`]
})
export class ElectionFormComponent {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  loading = signal(false);
  ok = signal(false);

  form = this.fb.group({
    name: ['', Validators.required],
    details: [''],
    scheduledAt: [new Date(), Validators.required],
    quorumMinimo: [0.5, [Validators.required]],
    questions: this.fb.array<FormGroup<any>>([])
  });

  get questions(){ return this.form.get('questions') as FormArray<FormGroup>; }
  addQuestion(){ this.questions.push(this.fb.group({ text: ['', Validators.required], options: this.fb.array<FormControl<string>>([this.fb.nonNullable.control('Sí'), this.fb.nonNullable.control('No')]) })); }
  removeQuestion(i:number){ this.questions.removeAt(i); }
  addOption(i:number){ (this.questions.at(i).get('options') as FormArray<FormControl<string>>).push(this.fb.nonNullable.control('')); }
  removeOption(i:number,j:number){ (this.questions.at(i).get('options') as FormArray).removeAt(j); }

  submit(){
    if (this.form.invalid) return;
    this.loading.set(true); this.ok.set(false);
    const v = this.form.value;
    const dto = {
      name: v.name,
      details: v.details,
      scheduledAt: v.scheduledAt,
      quorumMinimo: v.quorumMinimo,
      questions: (v.questions||[]).map((q:any)=>({ text: q.text, options: q.options }))
    };
    this.http.post('/api/elections', dto).subscribe({
      next: _ => { this.loading.set(false); this.ok.set(true); this.form.reset(); (this.form.get('questions') as FormArray).clear(); },
      error: _ => { this.loading.set(false); }
    })
  }
}
