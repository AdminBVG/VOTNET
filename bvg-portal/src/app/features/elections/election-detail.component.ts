import { Component, inject, signal, AfterViewInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NgFor, NgIf, DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { LiveService } from '../../core/live.service';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { FilterPresentPipe } from './filter-present.pipe';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-election-detail',
  standalone: true,
  imports: [NgFor, NgIf, DecimalPipe, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatTableModule, MatSnackBarModule, ReactiveFormsModule, MatSelectModule, MatPaginatorModule, MatSortModule, FilterPresentPipe, MatDatepickerModule, MatNativeDateModule],
  template: `
  <div class="page">
    <h2>Elección {{id()}}</h2>
    <mat-card *ngIf="editMode()" class="mat-elevation-z1">
      <h3>Editar configuración</h3>
      <form [formGroup]="editForm" (ngSubmit)="saveEdit()" class="edit-grid">
        <mat-form-field appearance="outline">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="name">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Detalles</mat-label>
          <input matInput formControlName="details">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Fecha</mat-label>
          <input matInput [matDatepicker]="picker" [value]="editDate()" (dateChange)="onEditDate($event.value)">
          <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Hora</mat-label>
          <input matInput type="time" [value]="editTime()" (input)="onEditTime($any($event.target).value)">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Quórum mínimo (%)</mat-label>
          <input matInput type="number" min="0" max="100" formControlName="quorumPct">
        </mat-form-field>
        <div class="actions">
          <button mat-stroked-button type="button" (click)="cancelEdit()">Cancelar</button>
          <button mat-raised-button color="primary" [disabled]="editForm.invalid">Guardar</button>
        </div>
      </form>
    </mat-card>
    <div class="grid">
      <mat-card *ngIf="!editMode()">
        <h3>Quórum</h3>
        <div *ngIf="quorum() as q">Total: {{q.total}} | Presentes: {{q.present}} | %: {{(q.quorum*100) | number:'1.0-2'}}%</div>
      </mat-card>

      <mat-card *ngIf="!editMode()">
        <h3>Subir padrón (Excel)</h3>
        <div class="upload">
          <a mat-stroked-button color="primary" href="/api/elections/padron-template" download>Descargar plantilla Excel</a>
          <input type="file" #padronInput class="hidden" (change)="onPadron($event)" accept=".xlsx,.xls" />
          <button mat-stroked-button color="primary" type="button" (click)="padronInput.click()">Subir padrón</button>
          <span class="file" *ngIf="lastPadronFile">{{ lastPadronFile }}</span>
        </div>
        <div *ngIf="padronUploading()">Subiendo...</div>
      </mat-card>

      <mat-card *ngIf="!editMode()">
        <h3>Padron</h3>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Buscar accionista</mat-label>
          <input matInput (keyup)="applyFilter($event)">
        </mat-form-field>
        <table mat-table [dataSource]="padronDS" matSort class="mat-elevation-z1 compact" *ngIf="padronDS.data.length">
          <ng-container matColumnDef="id">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>ID</th>
            <td mat-cell *matCellDef="let p">{{p.shareholderId}}</td>
          </ng-container>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Nombre</th>
            <td mat-cell *matCellDef="let p">{{p.shareholderName}}</td>
          </ng-container>
          <ng-container matColumnDef="shares">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Acciones</th>
            <td mat-cell *matCellDef="let p">{{p.shares}}</td>
          </ng-container>
          <ng-container matColumnDef="attendance" *ngIf="canAttend">
            <th mat-header-cell *matHeaderCellDef>Asistencia</th>
            <td mat-cell *matCellDef="let p">
              <button mat-button [disabled]="p.attendance==='Presencial'" (click)="setAtt(p.id,'Presencial')">Presencial</button>
              <button mat-button [disabled]="p.attendance==='Virtual'" (click)="setAtt(p.id,'Virtual')">Virtual</button>
              <button mat-button [disabled]="p.attendance==='None'" (click)="setAtt(p.id,'None')">Ausente</button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="padronCols"></tr>
          <tr mat-row *matRowDef="let row; columns: padronCols;"></tr>
        </table>
        <mat-paginator [pageSize]="10" [pageSizeOptions]="[5,10,25,50]"></mat-paginator>
      </mat-card>

      <mat-card *ngIf="!editMode()">
        <h3>Asignaciones</h3>
        <form [formGroup]="assignForm" (ngSubmit)="addAssign()" class="assign-form">
          <mat-form-field appearance="outline">
            <mat-label>UserId</mat-label>
            <input matInput formControlName="userId">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Rol</mat-label>
            <input matInput formControlName="role" placeholder="ElectionObserver | ElectionRegistrar">
          </mat-form-field>
          <button mat-raised-button color="primary" [disabled]="assignForm.invalid">Agregar</button>
        </form>
        <table mat-table [dataSource]="assignments()" class="mat-elevation-z1" *ngIf="assignments().length">
          <ng-container matColumnDef="userId">
            <th mat-header-cell *matHeaderCellDef>Usuario</th>
            <td mat-cell *matCellDef="let a">{{a.userId}}</td>
          </ng-container>
          <ng-container matColumnDef="role">
            <th mat-header-cell *matHeaderCellDef>Rol</th>
            <td mat-cell *matCellDef="let a">{{a.role}}</td>
          </ng-container>
          <ng-container matColumnDef="action">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let a"><button mat-button color="warn" (click)="removeAssign(a.id)">Quitar</button></td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="assignCols"></tr>
          <tr mat-row *matRowDef="let row; columns: assignCols;"></tr>
        </table>
      </mat-card>

      <mat-card *ngIf="!editMode()">
        <h3>Resultados</h3>
        <div *ngIf="!results().length">Sin datos / permisos.</div>
        <div *ngFor="let q of results()" class="q">
          <h4>{{q.text}}</h4>
          <table mat-table [dataSource]="q.options" class="mat-elevation-z1">
            <ng-container matColumnDef="text">
              <th mat-header-cell *matHeaderCellDef>Opción</th>
              <td mat-cell *matCellDef="let o">{{o.text}}</td>
            </ng-container>
            <ng-container matColumnDef="votes">
              <th mat-header-cell *matHeaderCellDef>Votos</th>
              <td mat-cell *matCellDef="let o">{{o.votes}}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="resCols"></tr>
            <tr mat-row *matRowDef="let row; columns: resCols;"></tr>
          </table>
        </div>
      </mat-card>

      <mat-card *ngIf="canRegister && !editMode()">
        <h3>Registrar voto</h3>
        <div class="vote-form">
          <mat-form-field appearance="outline">
            <mat-label>Accionista presente</mat-label>
            <mat-select [(value)]="votePadronId">
              <mat-option *ngFor="let p of padronDS.data | filterPresent" [value]="p.id">{{p.shareholderName}} ({{p.shares}})</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Pregunta</mat-label>
            <mat-select [(value)]="voteQuestionId" (selectionChange)="voteOptionId=null">
              <mat-option *ngFor="let q of results()" [value]="q.questionId">{{q.text}}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Opción</mat-label>
            <mat-select [(value)]="voteOptionId">
              <mat-option *ngFor="let o of getOptionsForSelectedQuestion()" [value]="o.optionId">{{o.text}}</mat-option>
            </mat-select>
          </mat-form-field>
          <button mat-raised-button color="primary" (click)="registerVote()" [disabled]="!votePadronId || !voteQuestionId || !voteOptionId">Registrar</button>
        </div>
        <div class="mt8" *ngIf="canClose">
          <button mat-stroked-button color="warn" (click)="closeElection()">Cerrar elección</button>
        </div>
      </mat-card>
    </div>
  </div>
  `,
  styles: [
    `.upload{display:flex;align-items:center;gap:12px}
     .hidden{display:none}
     .file{opacity:.85}
     .grid{display:grid; gap:16px}
     .assign-form{display:flex; gap:8px; align-items:center; flex-wrap:wrap}
     .q{margin-bottom:12px}
     .vote-form{display:flex; gap:8px; flex-wrap:wrap; align-items:center}
     .mt8{margin-top:8px}
     table.compact th, table.compact td{ font-size:13px }
     .edit-grid{ display:grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap:12px; align-items:end }
     .actions{ grid-column: 1 / -1; display:flex; gap:8px; justify-content:flex-end }
    `]
})
export class ElectionDetailComponent implements AfterViewInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private router = inject(Router);
  private snack = inject(MatSnackBar);
  private live = inject(LiveService);
  private auth = inject(AuthService);

  id = signal<string>('');
  editMode = signal(false);
  editForm = inject(FormBuilder).group({ name:['', Validators.required], details:[''], quorumPct:[50, [Validators.min(0), Validators.max(100)]] });
  private editSelDate = signal<Date | null>(null);
  private editSelTime = signal<string>('09:00');
  padronUploading = signal(false);
  lastPadronFile: string | null = null;
  padronDS = new MatTableDataSource<any>([]);
  padronCols = ['id','name','shares','attendance'];
  assignments = signal<any[]>([]);
  assignCols = ['userId','role','action'];
  resCols = ['text','votes'];
  results = signal<any[]>([]);
  quorum = signal<{total:number,present:number,quorum:number}|null>(null);

  votePadronId: string | null = null;
  voteQuestionId: string | null = null;
  voteOptionId: string | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  assignForm = inject(FormBuilder).group({ userId: ['', Validators.required], role: ['', Validators.required] });

  constructor(){
    this.id.set(this.route.snapshot.params['id']);
    this.editMode.set(this.route.snapshot.queryParamMap.get('mode')==='edit');
    this.loadAssignments();
    this.loadResults();
    this.loadPadron();
    this.loadQuorum();
    this.live.onVoteRegistered(()=> { this.loadResults(); this.loadQuorum(); });
    if (this.editMode()) this.prefillEdit();
  }
  ngAfterViewInit(){
    if (this.paginator) this.padronDS.paginator = this.paginator;
    if (this.sort) this.padronDS.sort = this.sort;
    this.padronDS.filterPredicate = (data, filter) =>
      (data.shareholderId + ' ' + data.shareholderName).toLowerCase().includes(filter);
  }

  onPadron(e: Event){
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.lastPadronFile = `${file.name} (${Math.round(file.size/1024)} KB)`;
    this.padronUploading.set(true);
    const fd = new FormData();
    fd.append('file', file);
    this.http.post(`/api/elections/${this.id()}/padron`, fd).subscribe({
      next: _=> { this.padronUploading.set(false); this.snack.open('Padrón cargado','OK',{duration:2000}); this.loadPadron(); },
      error: err=> { this.padronUploading.set(false); this.snack.open('Error al cargar padrón','OK',{duration:3000}); }
    });
  }

  loadAssignments(){
    this.http.get<any[]>(`/api/elections/${this.id()}/assignments`).subscribe({ next: d=> this.assignments.set(d), error: _=> this.assignments.set([]) });
  }
  addAssign(){
    if (this.assignForm.invalid) return;
    this.http.post(`/api/elections/${this.id()}/assignments`, this.assignForm.value).subscribe({
      next: _=> { this.assignForm.reset(); this.loadAssignments(); this.snack.open('Asignación creada','OK',{duration:2000}); },
      error: _=> this.snack.open('Error al crear asignación','OK',{duration:3000})
    });
  }
  removeAssign(assignmentId: string){
    this.http.delete(`/api/elections/${this.id()}/assignments/${assignmentId}`).subscribe({ next: _=> { this.loadAssignments(); this.snack.open('Asignación eliminada','OK',{duration:2000}); } });
  }

  loadResults(){
    this.http.get<any[]>(`/api/elections/${this.id()}/results`).subscribe({ next: d=> this.results.set(d as any[]), error: _=> this.results.set([]) });
  }

  loadPadron(){ this.http.get<any[]>(`/api/elections/${this.id()}/padron`).subscribe({ next: d=> { this.padronDS.data = d; this.ngAfterViewInit(); }, error: _=> { this.padronDS.data = []; } }); }
  loadQuorum(){ this.http.get<any>(`/api/elections/${this.id()}/quorum`).subscribe({ next: d=> this.quorum.set({ total: d.total ?? d.Total, present: d.present ?? d.Present, quorum: d.quorum ?? d.Quorum }), error: _=> this.quorum.set(null) }); }
  setAtt(padronId: string, att: 'None'|'Virtual'|'Presencial'){
    this.http.post(`/api/elections/${this.id()}/padron/${padronId}/attendance`, { attendance: att }).subscribe({
      next: _=> { this.snack.open('Asistencia actualizada','OK',{duration:1500}); this.loadPadron(); this.loadQuorum(); },
      error: _=> this.snack.open('Error al actualizar','OK',{duration:2000})
    });
  }

  // Edit support methods
  prefillEdit(){
    this.http.get<any[]>(`/api/elections`).subscribe({ next: (list:any[]) => {
      const e = (list||[]).find((x:any)=> (x.id ?? x.Id) === this.id());
      if (!e) return;
      this.editForm.patchValue({ name: e.name ?? e.Name, details: e.details ?? e.Details, quorumPct: Math.round(((e.quorumMinimo ?? e.QuorumMinimo) || 0)*100) });
      const dt = new Date(e.scheduledAt ?? e.ScheduledAt);
      this.editSelDate.set(dt);
      const hh = String(dt.getHours()).padStart(2,'0'); const mm = String(dt.getMinutes()).padStart(2,'0');
      this.editSelTime.set(`${hh}:${mm}`);
    }});
  }
  editDate(){ return this.editSelDate(); }
  editTime(){ return this.editSelTime(); }
  onEditDate(d: Date | null){ this.editSelDate.set(d); }
  onEditTime(t: string){ this.editSelTime.set(t || '09:00'); }
  saveEdit(){
    const v:any = this.editForm.value;
    const d = this.editSelDate(); if (!d) return;
    const [h,m] = (this.editSelTime()||'09:00').split(':').map((x:string)=>parseInt(x,10));
    const out = new Date(d); out.setHours(h||0, m||0, 0, 0);
    const dto:any = { name: v.name, details: v.details, scheduledAt: out.toISOString(), quorumMinimo: Math.min(1, Math.max(0, (v.quorumPct||0)/100)) };
    this.http.put(`/api/elections/${this.id()}`, dto).subscribe({ next: _=> { this.snack.open('Elección actualizada','OK',{duration:1500}); this.router.navigate(['/elections', this.id()]); this.editMode.set(false); this.loadQuorum(); }, error: _=> this.snack.open('Error al actualizar','OK',{duration:2000}) });
  }
  cancelEdit(){ this.router.navigate(['/elections', this.id()]); this.editMode.set(false); }

  getOptionsForSelectedQuestion(){
    const q = this.results().find((x:any)=> (x.questionId ?? x.QuestionId) === this.voteQuestionId);
    return q ? (q.options ?? q.Options) : [];
  }
  registerVote(){
    if (!this.votePadronId || !this.voteQuestionId || !this.voteOptionId) return;
    const dto = { padronId: this.votePadronId, questionId: this.voteQuestionId, optionId: this.voteOptionId } as any;
    this.http.post(`/api/elections/${this.id()}/votes`, dto).subscribe({
      next: _=> { this.snack.open('Voto registrado','OK',{duration:1500}); this.loadResults(); this.live.onVoteRegistered(()=>{}); },
      error: err => {
        if (err.status === 400) this.snack.open('Quórum no alcanzado o elección cerrada','OK',{duration:2500});
        else if (err.status === 403) this.snack.open('No tienes permiso para registrar','OK',{duration:2500});
        else this.snack.open('Error al registrar voto','OK',{duration:2500});
      }
    });
  }
  closeElection(){
    this.http.post(`/api/elections/${this.id()}/close`, {}).subscribe({
      next: _=> { this.snack.open('Elección cerrada','OK',{duration:2000}); this.loadResults(); },
      error: _=> this.snack.open('No autorizado para cerrar','OK',{duration:2500})
    });
  }
  applyFilter(ev: Event){
    const v = (ev.target as HTMLInputElement)?.value ?? '';
    this.padronDS.filter = v.trim().toLowerCase();
  }

  get canAttend(){ return this.auth.hasRole('GlobalAdmin') || this.auth.hasRole('VoteAdmin') || this.auth.hasRole('ElectionRegistrar'); }
  get canRegister(){ return this.auth.hasRole('GlobalAdmin') || this.auth.hasRole('VoteAdmin') || this.auth.hasRole('ElectionRegistrar'); }
  get canClose(){ return this.auth.hasRole('GlobalAdmin') || this.auth.hasRole('VoteAdmin'); }
}
  prefillEdit(){
    this.http.get<any[]>(`/api/elections`).subscribe({ next: list => {
      const e = (list||[]).find((x:any)=> (x.id ?? x.Id) === this.id());
      if (!e) return;
      this.editForm.patchValue({ name: e.name ?? e.Name, details: e.details ?? e.Details, quorumPct: Math.round(((e.quorumMinimo ?? e.QuorumMinimo) || 0)*100) });
      const dt = new Date(e.scheduledAt ?? e.ScheduledAt);
      this.editSelDate.set(dt);
      const hh = String(dt.getHours()).padStart(2,'0'); const mm = String(dt.getMinutes()).padStart(2,'0');
      this.editSelTime.set(`${hh}:${mm}`);
    }});
  }
  editDate(){ return this.editSelDate(); }
  editTime(){ return this.editSelTime(); }
  onEditDate(d: Date | null){ this.editSelDate.set(d); }
  onEditTime(t: string){ this.editSelTime.set(t || '09:00'); }
  saveEdit(){
    const v = this.editForm.value as any;
    const d = this.editSelDate();
    if (!d) return;
    const [h,m] = (this.editSelTime()||'09:00').split(':').map(x=>parseInt(x,10));
    const out = new Date(d); out.setHours(h||0, m||0, 0, 0);
    const dto:any = { name: v.name, details: v.details, scheduledAt: out.toISOString(), quorumMinimo: Math.min(1, Math.max(0, (v.quorumPct||0)/100)) };
    this.http.put(`/api/elections/${this.id()}`, dto).subscribe({ next: _=> { this.snack.open('Elección actualizada','OK',{duration:1500}); this.router.navigate(['/elections', this.id()]); this.editMode.set(false); this.loadQuorum(); }, error: _=> this.snack.open('Error al actualizar','OK',{duration:2000}) });
  }
  cancelEdit(){ this.router.navigate(['/elections', this.id()]); this.editMode.set(false); }
