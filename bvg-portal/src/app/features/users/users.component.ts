import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgIf, NgFor } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormsModule } from '@angular/forms';
import { UiButtonDirective } from '../../ui/button.directive';
import { UiInputDirective } from '../../ui/input.directive';
import { UiSwitchComponent } from '../../ui/switch.component';
import { UiIconComponent } from '../../ui/icon.component';
import { UiSelectComponent } from '../../ui/select/select.component';
import { ToastService } from '../../ui/toast/toast.service';

interface UserDto { id: string; userName: string; email: string; isActive: boolean; role?: string; }

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [NgIf, NgFor, ReactiveFormsModule, FormsModule, UiButtonDirective, UiInputDirective, UiSwitchComponent, UiSelectComponent, UiIconComponent],
  template: `
  <div class="p-4">
    <h2 class="text-xl font-semibold mb-3">Usuarios</h2>
    <div class="user-card rounded-2xl border border-gray-200 bg-white shadow-card p-4">
      <h3 class="font-semibold mb-2">Crear usuario</h3>
      <form [formGroup]="form" (ngSubmit)="create()" class="user-form">
        <div>
          <label class="field-label">Usuario</label>
          <input uiInput formControlName="userName">
        </div>
        <div>
          <label class="field-label">Email</label>
          <input uiInput formControlName="email">
        </div>
        <div class="pw">
          <label class="field-label">ContraseÃ±a</label>
          <input uiInput type="password" formControlName="password">
          <div class="field-helper">MÃ­nimo 6 caracteres y al menos 1 dÃ­gito</div>
          <div class="field-error" *ngIf="form.controls.password.hasError('required')">La contraseÃ±a es obligatoria</div>
          <div class="field-error" *ngIf="form.controls.password.hasError('minlength')">Debe tener al menos 6 caracteres</div>
          <div class="field-error" *ngIf="form.controls.password.hasError('pattern')">Debe incluir al menos un nÃºmero</div>
        </div>
        <div>
          <label class="field-label">Rol global (opcional)</label>
          <ui-select [options]="roleOptions" formControlName="role" [searchable]="true"></ui-select>
        </div>
        <div class="actions"><button uiBtn="primary" [disabled]="form.invalid">Crear</button></div>
      </form>
    </div>
    <h3 class="list-title">Usuarios:</h3>
    <!-- Skeleton while loading -->
    <div *ngIf="loading(); else listOrEmpty">
      <div class="rounded-2xl border border-gray-200 bg-white shadow-card p-4 mb-3">
        <div class="skeleton-line w-48 mb-2"></div>
        <div class="skeleton-line w-full mb-2"></div>
        <div class="skeleton-line w-5/6"></div>
      </div>
    </div>
    <ng-template #listOrEmpty>
    <table class="table-base table-compact thead-sticky row-zebra" *ngIf="items().length; else empty">
      <thead>
        <tr><th class="text-left p-2">Usuario</th><th class="text-left p-2">Email</th><th class="text-left p-2">Activo</th><th class="text-left p-2">Rol global</th><th class="w-24"></th></tr>
      </thead>
      <tbody>
        <tr *ngFor="let u of items()" class="border-t">
          <td class="p-2">{{u.userName}}</td>
          <td class="p-2">{{u.email}}</td>
          <td class="p-2"><ui-switch [checked]="u.isActive" (checkedChange)="toggleActive(u)"></ui-switch></td>
          <td class="p-2">
            <ui-select class="w-44" [options]="roleOptions" [ngModel]="u.role || ''" (ngModelChange)="updateRole(u, $event)" [searchable]="true"></ui-select>
          </td>
          <td class="p-2 text-right"><button uiBtn="danger" size="sm" (click)="remove(u)">Eliminar</button></td>
        </tr>
      </tbody>
    </table>
    <ng-template #empty>
      <div class="rounded-2xl border border-gray-200 bg-white shadow-card p-10 flex flex-col items-center gap-2 text-muted">
        <ui-icon name="empty" [size]="48"></ui-icon>
        <div>No hay datos o no tienes permisos.</div>
      </div>
    </ng-template>
    </ng-template>
  </div>
  `,
  styles: [`
    table{ width:100% }
    .list-title{ margin:16px 0 8px; font-weight:600 }
    .user-form{ display:grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); column-gap:16px; row-gap:12px; align-items:end }
    .user-form .pw{ grid-column: span 1 }
    .user-form .actions{ justify-self:end; align-self:end; margin-left:8px }
    @media (min-width: 900px){ .user-form{ grid-template-columns: repeat(4, minmax(220px,1fr)) } .user-form .actions{ grid-column: 4 } }
    td .mini{ width: 180px; margin:0 }
    .cell-role{ display:flex; align-items:center }
  `]
})
export class UsersComponent {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  items = signal<UserDto[]>([]);
  loading = signal(true);
  cols = ['userName','email','isActive','role','actions'];
  form = this.fb.group({
    userName:['', Validators.required],
    email:['', [Validators.required]],
    password:['', [Validators.required, Validators.minLength(6), Validators.pattern(/\d/)]],
    role:['']
  });
  roleOptions = [
    { label: 'Sin rol global', value: '' },
    { label: 'Funcional', value: 'Functional' },
    { label: 'GlobalAdmin', value: 'GlobalAdmin' },
    { label: 'VoteAdmin', value: 'VoteAdmin' },
  ];

  constructor(){
    this.http.get<UserDto[]>(`/api/users`).subscribe({
      next: (data) => { this.items.set(data); this.loading.set(false); },
      error: () => { this.items.set([]); this.loading.set(false); }
    });
  }
  create(){
    if (this.form.invalid) return;
    this.http.post('/api/users', this.form.value).subscribe({
      next: _=> {
        this.toast.show('Usuario creado','success',2000);
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
        this.toast.show(msg, 'error', 5000);
      }
    });
  }
  updateRole(u: UserDto, role: string){
    this.http.put(`/api/users/${u.id}/role`, { role }).subscribe({
      next: _=> { u.role = role; this.toast.show('Rol actualizado','success',1500); },
      error: err=> {
        const e = err?.error; const msg = e?.error ? e.error : 'Error al actualizar rol';
        this.toast.show(msg,'error',2000);
      }
    });
  }
  toggleActive(u: UserDto){
    this.http.put(`/api/users/${u.id}`, { isActive: !u.isActive }).subscribe({ next: (res:any)=> { u.isActive = res.isActive; this.toast.show('Estado actualizado','success',1500); } });
  }
  remove(u: UserDto){
    this.http.delete(`/api/users/${u.id}`).subscribe({ next: _=> { this.toast.show('Usuario eliminado','success',1500); this.http.get<UserDto[]>(`/api/users`).subscribe(d=>this.items.set(d)); } });
  }
}

