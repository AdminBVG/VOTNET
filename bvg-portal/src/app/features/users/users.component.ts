import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { NgIf } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

interface UserDto { id: string; userName: string; email: string; isActive: boolean; role?: string; }

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [MatTableModule, NgIf, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, ReactiveFormsModule, MatSelectModule, MatSnackBarModule, MatSlideToggleModule],
  template: `
  <div class="page">
    <h2>Usuarios</h2>
    <mat-card class="user-card">
      <h3>Crear usuario</h3>
      <form [formGroup]="form" (ngSubmit)="create()" class="user-form">
        <mat-form-field appearance="outline">
          <mat-label>Usuario</mat-label>
          <input matInput formControlName="userName">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email">
        </mat-form-field>
        <mat-form-field appearance="outline" class="pw">
          <mat-label>Contraseña</mat-label>
          <input matInput type="password" formControlName="password">
          <mat-hint align="start">Mínimo 6 caracteres y al menos 1 dígito</mat-hint>
          <mat-error *ngIf="form.controls.password.hasError('required')">La contraseña es obligatoria</mat-error>
          <mat-error *ngIf="form.controls.password.hasError('minlength')">Debe tener al menos 6 caracteres</mat-error>
          <mat-error *ngIf="form.controls.password.hasError('pattern')">Debe incluir al menos un número</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Rol global (opcional)</mat-label>
          <mat-select formControlName="role">
            <mat-option [value]="''">Sin rol global</mat-option>
            <mat-option value="Functional">Funcional</mat-option>
            <mat-option value="GlobalAdmin">GlobalAdmin</mat-option>
            <mat-option value="VoteAdmin">VoteAdmin</mat-option>
          </mat-select>
        </mat-form-field>
        <div class="actions"><button mat-raised-button color="primary" [disabled]="form.invalid">Crear</button></div>
      </form>
    </mat-card>
    <h3 class="list-title">Usuarios:</h3>
    <table mat-table [dataSource]="items()" class="mat-elevation-z1 users-table" *ngIf="items().length">
      <ng-container matColumnDef="userName">
        <th mat-header-cell *matHeaderCellDef>Usuario</th>
        <td mat-cell *matCellDef="let u">{{u.userName}}</td>
      </ng-container>
      <ng-container matColumnDef="email">
        <th mat-header-cell *matHeaderCellDef>Email</th>
        <td mat-cell *matCellDef="let u">{{u.email}}</td>
      </ng-container>
      <ng-container matColumnDef="isActive">
        <th mat-header-cell *matHeaderCellDef>Activo</th>
        <td mat-cell *matCellDef="let u"><mat-slide-toggle color="primary" [checked]="u.isActive" (change)="toggleActive(u)"></mat-slide-toggle></td>
      </ng-container>
      <ng-container matColumnDef="role">
        <th mat-header-cell *matHeaderCellDef>Rol global</th>
        <td mat-cell *matCellDef="let u" class="cell-role">
          <mat-form-field appearance="outline" class="mini">
            <mat-select [value]="u.role || ''" (selectionChange)="updateRole(u, $event.value)">
              <mat-option [value]="''">Sin rol</mat-option>
              <mat-option value="Functional">Funcional</mat-option>
              <mat-option value="GlobalAdmin">GlobalAdmin</mat-option>
              <mat-option value="VoteAdmin">VoteAdmin</mat-option>
            </mat-select>
          </mat-form-field>
        </td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef></th>
        <td mat-cell *matCellDef="let u"><button mat-button color="warn" (click)="remove(u)">Eliminar</button></td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="cols"></tr>
      <tr mat-row *matRowDef="let row; columns: cols;"></tr>
    </table>
    <div *ngIf="!items().length">No hay datos o no tienes permisos.</div>
  </div>
  `,
  styles: [`
    .page{ padding:16px }
    .user-card{ padding:16px }
    table{ width:100% }
    .users-table{ margin-top:12px }
    .list-title{ margin:16px 0 8px; font-weight:600 }
    .user-form{ display:grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); column-gap:16px; row-gap:12px; align-items:end }
    .user-form .pw{ grid-column: span 1 }
    .user-form .actions{ justify-self:end; align-self:end; margin-left:8px }
    @media (min-width: 900px){ .user-form{ grid-template-columns: repeat(4, minmax(220px,1fr)) } .user-form .actions{ grid-column: 4 } }
    td .mini{ width: 180px; margin:0 }
    .cell-role{ display:flex; align-items:center }
    :host ::ng-deep .mat-mdc-cell{ vertical-align: middle }
    :host ::ng-deep .cell-role .mat-mdc-form-field-flex{ align-items:center }
    :host ::ng-deep .cell-role .mat-mdc-form-field-infix{ padding-top:6px; padding-bottom:6px }
  `]
})
export class UsersComponent {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  items = signal<UserDto[]>([]);
  cols = ['userName','email','isActive','role','actions'];
  form = this.fb.group({
    userName:['', Validators.required],
    email:['', [Validators.required]],
    password:['', [Validators.required, Validators.minLength(6), Validators.pattern(/\d/)]],
    role:['']
  });

  constructor(){
    this.http.get<UserDto[]>(`/api/users`).subscribe({
      next: (data) => this.items.set(data),
      error: () => this.items.set([])
    });
  }
  create(){
    if (this.form.invalid) return;
    this.http.post('/api/users', this.form.value).subscribe({
      next: _=> {
        this.snack.open('Usuario creado','OK',{duration:2000});
        this.form.reset();
        this.http.get<UserDto[]>(`/api/users`).subscribe(d=>this.items.set(d));
      },
      error: (err:any)=> {
        let msg = 'Error al crear usuario';
        const e = err?.error;
        if (e?.error === 'invalid_user_data' && Array.isArray(e.details)) {
          msg = e.details.map((d:any)=> d.description || d.code).join('\n');
        } else if (e?.error) {
          msg = e.error;
        }
        this.snack.open(msg, 'OK', { duration: 5000 });
      }
    });
  }
  updateRole(u: UserDto, role: string){
    this.http.put(`/api/users/${u.id}/role`, { role }).subscribe({
      next: _=> { u.role = role; this.snack.open('Rol actualizado','OK',{duration:1500}); },
      error: err=> {
        const e = err?.error; const msg = e?.error ? e.error : 'Error al actualizar rol';
        this.snack.open(msg,'OK',{duration:2000});
      }
    });
  }
  toggleActive(u: UserDto){
    this.http.put(`/api/users/${u.id}`, { isActive: !u.isActive }).subscribe({ next: (res:any)=> { u.isActive = res.isActive; this.snack.open('Estado actualizado','OK',{duration:1500}); } });
  }
  remove(u: UserDto){
    this.http.delete(`/api/users/${u.id}`).subscribe({ next: _=> { this.snack.open('Usuario eliminado','OK',{duration:1500}); this.http.get<UserDto[]>(`/api/users`).subscribe(d=>this.items.set(d)); } });
  }
}
