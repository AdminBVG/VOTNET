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

interface UserDto { id: string; userName: string; email: string; isActive: boolean; }

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [MatTableModule, NgIf, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, ReactiveFormsModule, MatSelectModule, MatSnackBarModule, MatSlideToggleModule],
  template: `
  <div class="page">
    <h2>Usuarios</h2>
    <mat-card>
      <h3>Crear usuario</h3>
      <form [formGroup]="form" (ngSubmit)="create()">
        <mat-form-field appearance="outline">
          <mat-label>Usuario</mat-label>
          <input matInput formControlName="userName">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Contraseña</mat-label>
          <input matInput type="password" formControlName="password">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Rol</mat-label>
          <mat-select formControlName="role">
            <mat-optgroup label="Administración">
              <mat-option value="GlobalAdmin">GlobalAdmin</mat-option>
              <mat-option value="VoteAdmin">VoteAdmin</mat-option>
            </mat-optgroup>
            <mat-optgroup label="Operación de Votación">
              <mat-option value="ElectionRegistrar">ElectionRegistrar</mat-option>
              <mat-option value="ElectionObserver">ElectionObserver</mat-option>
              <mat-option value="ElectionVoter">ElectionVoter</mat-option>
              <mat-option value="VoteOperator">VoteOperator</mat-option>
            </mat-optgroup>
          </mat-select>
        </mat-form-field>
        <button mat-raised-button color="primary" [disabled]="form.invalid">Crear</button>
      </form>
    </mat-card>
    <table mat-table [dataSource]="items()" class="mat-elevation-z1" *ngIf="items().length">
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
        <td mat-cell *matCellDef="let u">{{u.isActive ? 'Sí' : 'No'}}</td>
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
  styles: [`.page{ padding:16px } table{ width:100% }`]
})
export class UsersComponent {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  items = signal<UserDto[]>([]);
  cols = ['userName','email','isActive','actions'];
  form = this.fb.group({ userName:['', Validators.required], email:['', [Validators.required]], password:['', Validators.required], role:['', Validators.required] });

  constructor(){
    this.http.get<UserDto[]>(`/api/users`).subscribe({
      next: (data) => this.items.set(data),
      error: () => this.items.set([])
    });
  }
  create(){
    if (this.form.invalid) return;
    this.http.post('/api/users', this.form.value).subscribe({ next: _=> { this.snack.open('Usuario creado','OK',{duration:2000}); this.form.reset(); this.http.get<UserDto[]>(`/api/users`).subscribe(d=>this.items.set(d)); }, error: _=> this.snack.open('Error al crear usuario','OK',{duration:3000}) });
  }
  toggleActive(u: UserDto){
    this.http.put(`/api/users/${u.id}`, { isActive: !u.isActive }).subscribe({ next: (res:any)=> { u.isActive = res.isActive; this.snack.open('Estado actualizado','OK',{duration:1500}); } });
  }
  remove(u: UserDto){
    this.http.delete(`/api/users/${u.id}`).subscribe({ next: _=> { this.snack.open('Usuario eliminado','OK',{duration:1500}); this.http.get<UserDto[]>(`/api/users`).subscribe(d=>this.items.set(d)); } });
  }
}
