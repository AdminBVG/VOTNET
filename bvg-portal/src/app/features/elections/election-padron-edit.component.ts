import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NgFor, NgIf, DecimalPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { UiButtonDirective } from '../../ui/button.directive';
import { UiInputDirective } from '../../ui/input.directive';
import { ToastService } from '../../ui/toast/toast.service';
import { AuthService } from '../../core/auth.service';
import { PadronRow, sortPadronByNumericId, canDeleteShareholder as canDeleteShareholderFn, getDeleteErrorMessage } from '../../shared/utils/padron.utils';

@Component({
  selector: 'app-election-padron-edit',
  standalone: true,
  imports: [NgFor, NgIf, DecimalPipe, ReactiveFormsModule, UiButtonDirective, UiInputDirective],
  template: `
   <div class="p-4">
     <div class="flex items-center justify-between mb-3">
       <h2 class="text-xl font-semibold">Editar Padrón - Elección {{id()}}</h2>
       <button uiBtn="secondary" (click)="goBack()">Volver</button>
     </div>

     <div class="rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 p-4 flex items-center gap-2" *ngIf="!canEdit">
       <span>⚠️</span>
       <span>No tienes permisos para editar el padrón de esta elección.</span>
     </div>

     <div *ngIf="canEdit" class="space-y-3">
       <div class="rounded-2xl border border-gray-200 bg-white shadow-card p-3">
         <div class="flex items-center justify-between mb-2">
           <h3 class="font-semibold">Lista de Accionistas</h3>
           <div class="text-sm text-gray-600 flex items-center gap-3">
             <span>{{padron().length}} accionistas</span>
             <span>Total acciones: {{getTotalShares() | number}}</span>
           </div>
         </div>
         <div class="flex items-center gap-2 mb-3">
           <button uiBtn="primary" (click)="openAddDialog()">➕ Agregar Accionista</button>
           <button uiBtn="secondary" (click)="loadPadron()">⟳ Recargar</button>
           <button uiBtn="secondary" (click)="debugData()">🐞 Debug</button>
         </div>

         <div *ngIf="!padron().length" class="text-center text-gray-600 py-10">
           <div class="text-4xl mb-2">👥</div>
           <p>No hay accionistas cargados</p>
           <div class="mt-3"><button uiBtn="primary" (click)="openAddDialog()">Agregar Primer Accionista</button></div>
         </div>

         <table *ngIf="padron().length" class="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
           <thead class="bg-gray-50 text-gray-600">
             <tr>
               <th class="text-left p-2">ID</th>
               <th class="text-left p-2">Nombre</th>
               <th class="text-left p-2">Acciones</th>
               <th class="text-left p-2">Representante Legal</th>
               <th class="text-left p-2">Apoderado</th>
               <th class="text-left p-2">Acciones</th>
             </tr>
           </thead>
           <tbody>
             <tr *ngFor="let row of padron()" class="border-t">
               <td class="p-2">{{row.shareholderId}}</td>
               <td class="p-2">{{row.shareholderName}}</td>
               <td class="p-2"><span class="font-mono">{{row.shares | number}}</span></td>
               <td class="p-2">{{row.legalRepresentative || '-'}}</td>
               <td class="p-2">{{row.proxy || '-'}}</td>
               <td class="p-2">
                 <div class="flex items-center gap-1">
                   <button uiBtn="secondary" size="sm" (click)="openEditDialog(row)" title="Editar accionista">✏️</button>
                   <button uiBtn="danger" size="sm" (click)="deleteShareholder(row)" [disabled]="!canDeleteShareholder(row)" [title]="!canDeleteShareholder(row) ? 'No se puede eliminar: ya tiene asistencia' : 'Eliminar'">🗑️</button>
                 </div>
               </td>
             </tr>
           </tbody>
         </table>
       </div>
     </div>

     <!-- Dialog -->
     <div *ngIf="showAddDialog" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
       <div class="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-xl p-4">
         <div class="flex items-center justify-between mb-2">
           <h3 class="font-semibold">{{ editingShareholder ? 'Editar accionista' : 'Agregar accionista' }}</h3>
           <button uiBtn="ghost" (click)="closeAddDialog()">✖</button>
         </div>
         <form [formGroup]="addForm" (ngSubmit)="submitAddShareholder()" class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
           <div>
             <label class="text-xs opacity-80">ID</label>
             <input uiInput formControlName="shareholderId" [disabled]="!!editingShareholder">
           </div>
           <div>
             <label class="text-xs opacity-80">Nombre</label>
             <input uiInput formControlName="shareholderName">
           </div>
           <div>
             <label class="text-xs opacity-80">Cantidad de Acciones</label>
             <input uiInput type="number" min="0" formControlName="shares">
           </div>
           <div>
             <label class="text-xs opacity-80">Representante Legal</label>
             <input uiInput formControlName="legalRepresentative">
           </div>
           <div>
             <label class="text-xs opacity-80">Apoderado</label>
             <input uiInput formControlName="proxy">
           </div>
           <div class="col-span-full flex justify-end gap-2 mt-2">
             <button uiBtn="secondary" type="button" (click)="closeAddDialog()">Cancelar</button>
             <button uiBtn="primary" [disabled]="addForm.invalid">Guardar</button>
           </div>
         </form>
       </div>
     </div>
   </div>
  `
})
export class ElectionPadronEditComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  private auth = inject(AuthService);

  id = signal<string>(this.route.snapshot.params['id']);
  padron = signal<PadronRow[]>([]);

  showAddDialog = false;
  editingShareholder: PadronRow | null = null;

  addForm = this.fb.group({
    shareholderId: ['', Validators.required],
    shareholderName: ['', Validators.required],
    shares: [0, [Validators.required, Validators.min(0)]],
    legalRepresentative: [''],
    proxy: ['']
  });

  get canEdit(){ return this.auth.hasRole('GlobalAdmin') || this.auth.hasRole('VoteAdmin'); }

  constructor(){ this.loadPadron(); }

  loadPadron(){
    this.http.get<PadronRow[]>(`/api/elections/${this.id()}/padron`).subscribe({
      next: data => {
        const sorted = sortPadronByNumericId(data || []);
        this.padron.set(sorted);
      },
      error: err => {
        console.error('Error cargando padrón:', err);
        this.padron.set([]);
      }
    });
  }

  deleteShareholder(row: PadronRow) {
    if (!this.canDeleteShareholder(row)) {
      const msg = getDeleteErrorMessage(row);
      if (msg) this.toast.show(msg, 'warning', 2500);
      return;
    }
    if (!confirm(`¿Estás seguro de eliminar al accionista "${row.shareholderName}"?`)) return;
    this.http.delete(`/api/elections/${this.id()}/padron/${row.id}`).subscribe({
      next: _ => { this.toast.show('Accionista eliminado correctamente','success',1500); this.loadPadron(); },
      error: err => { console.error('Error deleting shareholder:', err); this.toast.show('Error al eliminar accionista','error',2500); }
    });
  }
  canDeleteShareholder(row: PadronRow){ return canDeleteShareholderFn(row); }

  getTotalShares(): number { return this.padron().reduce((t, s) => t + (s.shares||0), 0); }

  openAddDialog(){
    this.editingShareholder = null;
    this.addForm.reset({ shareholderId: '', shareholderName: '', shares: 0, legalRepresentative: '', proxy: '' });
    this.showAddDialog = true;
  }
  openEditDialog(row: PadronRow){
    this.editingShareholder = row;
    this.addForm.reset({
      shareholderId: row.shareholderId,
      shareholderName: row.shareholderName,
      shares: row.shares,
      legalRepresentative: row.legalRepresentative || '',
      proxy: row.proxy || ''
    });
    this.showAddDialog = true;
  }
  closeAddDialog(){ this.showAddDialog = false; this.addForm.reset(); this.editingShareholder = null; }

  submitAddShareholder(){
    if (this.addForm.invalid) return;
    const v = this.addForm.getRawValue();
    if (this.editingShareholder){
      this.http.put(`/api/elections/${this.id()}/padron/${this.editingShareholder.id}`, v).subscribe({
        next: _ => { this.toast.show('Accionista actualizado','success',1500); this.closeAddDialog(); this.loadPadron(); },
        error: _ => this.toast.show('Error al actualizar accionista','error',2500)
      });
    } else {
      const exists = this.padron().some(s => s.shareholderId === v.shareholderId);
      if (exists) { this.toast.show('Ya existe un accionista con ese ID','warning',2500); return; }
      this.http.post(`/api/elections/${this.id()}/padron`, v).subscribe({
        next: _ => { this.toast.show('Accionista agregado','success',1500); this.closeAddDialog(); this.loadPadron(); },
        error: _ => this.toast.show('Error al agregar accionista','error',2500)
      });
    }
  }

  debugData(){
    console.log('=== DEBUG DATA ===');
    console.log('ID de elección:', this.id());
    console.log('Padron signal:', this.padron());
    console.log('Can edit:', this.canEdit);
    console.log('==================');
  }

  goBack(){ this.router.navigate(['/elections', this.id() ]); }
}
