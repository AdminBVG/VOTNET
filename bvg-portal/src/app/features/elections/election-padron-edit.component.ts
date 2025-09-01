import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NgFor, NgIf, DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/auth.service';
import { PadronRow, sortPadronByNumericId, canDeleteShareholder, getDeleteErrorMessage } from '../../shared/utils/padron.utils';

@Component({
  selector: 'app-election-padron-edit',
  standalone: true,
  imports: [
    NgFor, NgIf, DecimalPipe, MatCardModule, MatFormFieldModule, MatInputModule, 
    MatButtonModule, MatTableModule, MatSnackBarModule, ReactiveFormsModule,
    MatIconModule, MatTooltipModule
  ],
     template: `
   <div class="page">
     <div class="header">
       <h2>Editar Padrón - Elección {{id()}}</h2>
       <button mat-stroked-button (click)="goBack()">Volver</button>
     </div>

     <mat-card class="warning-card" *ngIf="!canEdit">
       <div class="warning">
         <mat-icon>warning</mat-icon>
         <span>No tienes permisos para editar el padrón de esta elección.</span>
       </div>
     </mat-card>

     <div class="content" *ngIf="canEdit">
       <mat-card>
         <div class="card-header">
           <h3>Lista de Accionistas</h3>
           <div class="header-info">
             <span class="count">{{padron().length}} accionistas</span>
             <span class="total-shares">Total acciones: {{getTotalShares()}}</span>
           </div>
         </div>
         
         <div class="toolbar">
           <div class="left-buttons">
             <button mat-raised-button color="primary" (click)="openAddDialog()">
               <mat-icon>add</mat-icon>
               Agregar Accionista
             </button>
             <button mat-stroked-button (click)="loadPadron()">
               <mat-icon>refresh</mat-icon>
               Recargar
             </button>
           </div>
           <div class="right-buttons">
             <button mat-stroked-button (click)="debugData()">
               <mat-icon>bug_report</mat-icon>
               Debug
             </button>
           </div>
         </div>
         
         <div *ngIf="padron().length === 0" class="no-data">
           <mat-icon>people_outline</mat-icon>
           <p>No hay accionistas cargados</p>
           <button mat-raised-button color="primary" (click)="openAddDialog()">
             <mat-icon>add</mat-icon>
             Agregar Primer Accionista
           </button>
         </div>
         
         <div class="table-container" *ngIf="padron().length > 0">
           <table mat-table [dataSource]="dataSource" class="mat-elevation-z1">
          <ng-container matColumnDef="id">
            <th mat-header-cell *matHeaderCellDef>ID</th>
            <td mat-cell *matCellDef="let row">{{row.shareholderId}}</td>
          </ng-container>
          
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Nombre</th>
            <td mat-cell *matCellDef="let row">{{row.shareholderName}}</td>
          </ng-container>

          <ng-container matColumnDef="shares">
            <th mat-header-cell *matHeaderCellDef>Cantidad de Acciones</th>
            <td mat-cell *matCellDef="let row">
              <span class="shares-number">{{row.shares | number}}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="representative">
            <th mat-header-cell *matHeaderCellDef>Representante Legal</th>
            <td mat-cell *matCellDef="let row">{{row.legalRepresentative || '-'}}</td>
          </ng-container>

          <ng-container matColumnDef="proxy">
            <th mat-header-cell *matHeaderCellDef>Apoderado</th>
            <td mat-cell *matCellDef="let row">{{row.proxy || '-'}}</td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Acciones</th>
            <td mat-cell *matCellDef="let row">
              <div class="actions-cell">
                <button mat-icon-button color="primary" (click)="openEditDialog(row)" matTooltip="Editar accionista">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn"
                        (click)="deleteShareholder(row)"
                        [disabled]="!this.canDeleteShareholder(row)"
                        [matTooltip]="!this.canDeleteShareholder(row) ? 'No se puede eliminar: ya tiene asistencia registrada' : 'Eliminar accionista'">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns;"></tr>
          </table>
        </div>
      </mat-card>
    </div>

     <!-- Diálogo para agregar accionista -->
     <div class="add-dialog-overlay" *ngIf="showAddDialog" (click)="closeAddDialog()">
       <div class="add-dialog" (click)="$event.stopPropagation()">
         <div class="dialog-header">
           <h3>{{ editingShareholder ? 'Editar Accionista' : 'Agregar Nuevo Accionista' }}</h3>
           <button mat-icon-button (click)="closeAddDialog()">
             <mat-icon>close</mat-icon>
           </button>
         </div>

         <form [formGroup]="addForm" (ngSubmit)="submitAddShareholder()">
           <div class="form-row">
             <mat-form-field appearance="outline">
               <mat-label>ID del Accionista</mat-label>
               <input matInput formControlName="shareholderId" placeholder="Ej: 1">
             </mat-form-field>
             
             <mat-form-field appearance="outline">
               <mat-label>Nombre del Accionista</mat-label>
               <input matInput formControlName="shareholderName" placeholder="Nombre completo">
             </mat-form-field>
           </div>
           
           <div class="form-row">
             <mat-form-field appearance="outline">
               <mat-label>Cantidad de Acciones</mat-label>
               <input matInput type="number" formControlName="shares" placeholder="0">
             </mat-form-field>
             
             <mat-form-field appearance="outline">
               <mat-label>Representante Legal</mat-label>
               <input matInput formControlName="legalRepresentative" placeholder="Opcional">
             </mat-form-field>
           </div>
           
           <div class="form-row">
             <mat-form-field appearance="outline" class="full-width">
               <mat-label>Apoderado</mat-label>
               <input matInput formControlName="proxy" placeholder="Opcional">
             </mat-form-field>
           </div>
           
           <div class="dialog-actions">
             <button mat-stroked-button type="button" (click)="closeAddDialog()">Cancelar</button>
             <button mat-raised-button color="primary" type="submit" [disabled]="!addForm.valid">
               <mat-icon>{{ editingShareholder ? 'save' : 'add' }}</mat-icon>
               {{ editingShareholder ? 'Guardar Cambios' : 'Agregar Accionista' }}
             </button>
           </div>
         </form>
       </div>
     </div>
   </div>
  `,
           styles: [`
        .page { padding: 16px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .warning-card { margin-bottom: 16px; }
        .warning { display: flex; align-items: center; gap: 8px; color: #f57c00; }
        .content { max-width: 1200px; }
        
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e0e0e0;
        }
        
        .header-info {
          display: flex;
          gap: 16px;
          font-size: 14px;
          color: #666;
        }
        
        .count { font-weight: 500; color: #1976d2; }
        .total-shares { font-weight: 500; color: #388e3c; }
        
        .toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          gap: 8px;
        }
        
        .left-buttons, .right-buttons {
          display: flex;
          gap: 8px;
        }
        
        .no-data {
          text-align: center;
          padding: 40px 20px;
          color: #666;
        }
        
        .no-data mat-icon {
          font-size: 48px;
          width: 48px;
          height: 48px;
          color: #ccc;
          margin-bottom: 16px;
        }
        
        .table-container {
          overflow-x: auto;
          border-radius: 4px;
        }
        
        .shares-number {
          font-weight: 500;
          color: #388e3c;
          min-width: 60px;
        }

        .actions-cell {
          display: flex;
          justify-content: center;
          gap: 8px;
        }
        
        /* Diálogo de agregar accionista */
        .add-dialog-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        
        .add-dialog {
          background: white;
          border-radius: 8px;
          padding: 24px;
          width: 90%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
        }
        
        .dialog-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e0e0e0;
        }
        
        .dialog-header h3 {
          margin: 0;
          color: #1976d2;
        }
        
        .form-row {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
        }
        
        .form-row mat-form-field {
          flex: 1;
        }
        
        .full-width {
          width: 100%;
        }
        
        .dialog-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #e0e0e0;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
          .form-row {
            flex-direction: column;
          }
          
          .toolbar {
            flex-direction: column;
            align-items: stretch;
          }
          
          .left-buttons, .right-buttons {
            justify-content: center;
          }
        }
      `]
})
export class ElectionPadronEditComponent {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private router = inject(Router);
  private snack = inject(MatSnackBar);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);

  id = signal<string>('');
  padron = signal<PadronRow[]>([]);
  dataSource = new MatTableDataSource<PadronRow>([]);
  columns = ['id', 'name', 'shares', 'representative', 'proxy', 'actions'];
  showAddDialog = false;
  editingShareholder: PadronRow | null = null;
  addForm = this.fb.group({
    shareholderId: ['', [Validators.required]],
    shareholderName: ['', [Validators.required]],
    shares: [0, [Validators.required, Validators.min(1)]],
    legalRepresentative: [''],
    proxy: ['']
  });

  ngOnInit() {
    console.log('Componente inicializado');
    console.log('ID de elección:', this.id());
    console.log('Columnas definidas:', this.columns);
  }

  constructor() {
    this.id.set(this.route.snapshot.params['id']);
    this.loadPadron();
  }

  get canEdit(): boolean {
    return this.auth.hasRole('GlobalAdmin') || this.auth.hasRole('VoteAdmin');
  }

  canDeleteShareholder(shareholder: PadronRow): boolean {
    return canDeleteShareholder(shareholder);
  }

  loadPadron() {
    this.http.get<PadronRow[]>(`/api/elections/${this.id()}/padron`).subscribe({
      next: data => {
        console.log('Datos recibidos del API:', data);
        // Ordenar por ID numéricamente usando utilidad compartida
        const sortedData = sortPadronByNumericId(data || []);
        console.log('Datos ordenados:', sortedData);
        this.padron.set(sortedData);
        this.dataSource.data = sortedData;
        console.log('DataSource actualizado:', this.dataSource.data.length, 'elementos');
      },
      error: err => {
        console.error('Error cargando padrón:', err);
        this.padron.set([]);
        this.dataSource.data = [];
      }
    });
  }

  deleteShareholder(row: PadronRow) {
    if (!canDeleteShareholder(row)) {
      const errorMessage = getDeleteErrorMessage(row);
      this.snack.open(errorMessage, 'OK', { duration: 2500 });
      return;
    }

    if (confirm(`¿Estás seguro de eliminar al accionista "${row.shareholderName}"?`)) {
      this.http.delete(`/api/elections/${this.id()}/padron/${row.id}`).subscribe({
        next: _ => {
          this.snack.open('Accionista eliminado correctamente', 'OK', { duration: 1500 });
          this.loadPadron();
        },
        error: err => {
          console.error('Error deleting shareholder:', err);
          this.snack.open('Error al eliminar accionista. Intente nuevamente.', 'OK', { duration: 3000 });
        }
      });
    }
  }

  getTotalShares(): number {
    return this.padron().reduce((total, shareholder) => total + shareholder.shares, 0);
  }

  openAddDialog() {
    this.editingShareholder = null;
    this.addForm.reset({
      shareholderId: '',
      shareholderName: '',
      shares: 0,
      legalRepresentative: '',
      proxy: ''
    });
    this.addForm.get('shareholderId')?.enable();
    this.showAddDialog = true;
  }

  openEditDialog(row: PadronRow) {
    this.editingShareholder = row;
    this.addForm.reset({
      shareholderId: row.shareholderId,
      shareholderName: row.shareholderName,
      shares: row.shares,
      legalRepresentative: row.legalRepresentative || '',
      proxy: row.proxy || ''
    });
    this.addForm.get('shareholderId')?.disable();
    this.showAddDialog = true;
  }

  closeAddDialog() {
    this.showAddDialog = false;
    this.addForm.reset();
    this.addForm.get('shareholderId')?.enable();
    this.editingShareholder = null;
  }

  submitAddShareholder() {
    if (this.addForm.valid) {
      const formValue = this.addForm.getRawValue();

      if (this.editingShareholder) {
        this.http.put(`/api/elections/${this.id()}/padron/${this.editingShareholder.id}`, formValue).subscribe({
          next: _ => {
            this.snack.open('Accionista actualizado correctamente', 'OK', { duration: 1500 });
            this.closeAddDialog();
            this.loadPadron();
          },
          error: err => {
            console.error('Error updating shareholder:', err);
            this.snack.open('Error al actualizar accionista. Intente nuevamente.', 'OK', { duration: 3000 });
          }
        });
      } else {
        const existingId = this.padron().find(s => s.shareholderId === formValue.shareholderId);
        if (existingId) {
          this.snack.open('Ya existe un accionista con ese ID', 'OK', { duration: 3000 });
          return;
        }

        this.http.post(`/api/elections/${this.id()}/padron`, formValue).subscribe({
          next: _ => {
            this.snack.open('Accionista agregado correctamente', 'OK', { duration: 1500 });
            this.closeAddDialog();
            this.loadPadron();
          },
          error: err => {
            console.error('Error adding shareholder:', err);
            this.snack.open('Error al agregar accionista. Intente nuevamente.', 'OK', { duration: 3000 });
          }
        });
      }
    }
  }

  debugData() {
    console.log('=== DEBUG DATA ===');
    console.log('ID de elección:', this.id());
    console.log('Padron signal:', this.padron());
    console.log('DataSource data:', this.dataSource.data);
    console.log('DataSource length:', this.dataSource.data.length);
    console.log('Columnas:', this.columns);
    console.log('Can edit:', this.canEdit);
    console.log('==================');
  }

  goBack() {
    this.router.navigate(['/elections', this.id()]);
  }
}
