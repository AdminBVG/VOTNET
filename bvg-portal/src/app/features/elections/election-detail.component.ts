﻿import { Component, inject, signal, AfterViewInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NgFor, NgIf, DecimalPipe, DatePipe, PercentPipe, NgClass } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators, FormControl } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { LiveService } from '../../core/live.service';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { FilterPresentPipe } from './filter-present.pipe';
import { AuthService } from '../../core/auth.service';
import { Roles, ALLOWED_ASSIGNMENT_ROLES } from '../../core/constants/roles';
import { PadronRow } from '../../shared/utils/padron.utils';
import { forkJoin } from 'rxjs';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-election-detail',
  standalone: true,
  imports: [NgFor, NgIf, DecimalPipe, DatePipe, PercentPipe, NgClass, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatTableModule, MatSnackBarModule, ReactiveFormsModule, FormsModule, MatSelectModule, MatPaginatorModule, MatSortModule, MatProgressBarModule, FilterPresentPipe, MatDatepickerModule, MatNativeDateModule, MatSlideToggleModule],
  template: `
  <div class="page">
    <h2 *ngIf="!canRegister || editMode()">Elección {{id()}}</h2>
    <mat-card class="mat-elevation-z1 status-card">
      <div class="status-row">
        <span class="chip status">{{status()}}</span>
        <span class="chip" [ngClass]="statusLocked() ? 'locked' : 'unlocked'">{{ statusLocked() ? 'Registro bloqueado' : 'Registro abierto' }}</span>
        <span class="chip" [ngClass]="(quorum()?.quorum||0) >= ((electionInfo()?.quorumMinimo ?? electionInfo()?.QuorumMinimo) || 0) ? 'ok' : 'warn'">Qu�rum: {{ (quorum()?.quorum||0) | percent:'1.0-0' }}</span>
        <span class="muted">Fecha: {{ (electionInfo()?.scheduledAt ?? electionInfo()?.ScheduledAt) | date:'short' }}</span>
      </div>
    </mat-card>
    <mat-card *ngIf="editMode() && canClose && (!quorum() || (quorum()?.present||0) === 0)" class="mat-elevation-z1">
      <h3>Editar configuración</h3>
      <form [formGroup]="editForm" (ngSubmit)="saveEdit()" class="edit-grid">
        <mat-form-field appearance="outline">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="name">
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
                <mat-slide-toggle [checked]="signingRequired" (change)="toggleSigning($event.checked)" *ngIf="canClose">Requerir firma para certificar</mat-slide-toggle><div class="actions">
          <button mat-stroked-button type="button" (click)="cancelEdit()">Cancelar</button>
          <button mat-raised-button color="primary" [disabled]="editForm.invalid">Guardar</button>
        </div>
      </form>
    </mat-card>
    <div class="grid" *ngIf="!canRegister || editMode()">
      <mat-card *ngIf="!editMode()">
        <h3>Detalle</h3>
        <div *ngIf="electionInfo() as info">
          <div><b>Nombre:</b> {{ info.name ?? info.Name }}</div>
          <div><b>Detalles:</b> {{ info.details ?? info.Details }}</div>
          <div><b>Fecha:</b> {{ (info.scheduledAt ?? info.ScheduledAt) | date:'medium' }}</div>
          <div><b>Quórum mínimo:</b> {{ ((info.quorumMinimo ?? info.QuorumMinimo) * 100) | number:'1.0-0' }}%</div>
        </div>
      </mat-card>
      <mat-card *ngIf="!editMode()">
        <h3>Quórum</h3>
        <div *ngIf="quorum() as q">
          Total: {{q.total}} | Presentes: {{q.present}} | %: {{(q.quorum*100) | number:'1.0-2'}}%
          <mat-progress-bar mode="determinate" [value]="q.quorum*100"></mat-progress-bar>
        </div>
      </mat-card>

      <!-- Solo mostrar en modo edición -->
      <mat-card *ngIf="editMode() && canClose">
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
          <!-- Solo mostrar botones de asistencia en modo edición -->
          <ng-container matColumnDef="attendance" *ngIf="canAttend && editMode()">
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

      <!-- Solo mostrar asignaciones en modo edición -->
      <mat-card *ngIf="editMode() && canClose">
        <h3>Asignaciones</h3>
        <form [formGroup]="assignForm" (ngSubmit)="addAssign()" class="assign-form">
          <mat-form-field appearance="outline">
            <mat-label>UserId</mat-label>
            <input matInput formControlName="userId">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Rol</mat-label>
            <input matInput formControlName="role" [placeholder]="assignmentRoles.join(' | ')">
          </mat-form-field>
          <button mat-raised-button color="primary" [disabled]="assignForm.invalid">Agregar</button>
        </form>
        <table mat-table [dataSource]="assignments()" class="mat-elevation-z1" *ngIf="assignments().length">
          <ng-container matColumnDef="userId">
             <th mat-header-cell *matHeaderCellDef>Usuario</th>
             <td mat-cell *matCellDef="let a">{{a.userName || a.UserName || a.userId}}</td>
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
        <div *ngFor="let q of results(); let i = index" class="q">
          <h4>{{q.text}}</h4>
          <div class="chart-container"><canvas id="res-chart-{{i}}"></canvas></div>
          <table mat-table [dataSource]="q.options" class="mat-elevation-z1">
            <ng-container matColumnDef="text">
              <th mat-header-cell *matHeaderCellDef>Opción</th>
              <td mat-cell *matCellDef="let o">{{o.text}}</td>
            </ng-container>
            <ng-container matColumnDef="votes">
              <th mat-header-cell *matHeaderCellDef>Votos</th>
              <td mat-cell *matCellDef="let o">{{o.votes}}</td>
            </ng-container>
            <ng-container matColumnDef="percent">
              <th mat-header-cell *matHeaderCellDef>%</th>
              <td mat-cell *matCellDef="let o">{{ (o.percent || o.Percent)*100 | number:'1.0-2' }}%</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="resCols"></tr>
            <tr mat-row *matRowDef="let row; columns: resCols;"></tr>
          </table>
        </div>
      </mat-card>
    </div>

    <!-- Se muestra el registro de votos si el usuario tiene permisos -->
    <mat-card *ngIf="canRegister && !(electionInfo()?.isClosed)">
      <h3>Registrar votos</h3>
      <ng-container *ngIf="!showSummary(); else summaryTpl">
        <div class="progress">Pregunta {{currentIndex()+1}} de {{results().length}}</div>
        <h4>{{currentQuestion()?.text}}</h4>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Aplicar a todos</mat-label>
          <mat-select [value]="globalSelections[currentQuestionId()]" (selectionChange)="applyAll($event.value)" aria-label="Aplicar opción a todos">
            <mat-option *ngFor="let o of getOptionsForCurrentQuestion()" [value]="o.optionId || o.OptionId">{{o.text}}</mat-option>
          </mat-select>
        </mat-form-field>
        <table mat-table [dataSource]="filteredPadron()" class="mat-elevation-z1 compact">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Accionista</th>
            <td mat-cell *matCellDef="let p">{{p.shareholderName}}</td>
          </ng-container>
          <ng-container matColumnDef="shares">
            <th mat-header-cell *matHeaderCellDef>Acciones</th>
            <td mat-cell *matCellDef="let p">{{p.shares}}</td>
          </ng-container>
          <ng-container matColumnDef="vote">
            <th mat-header-cell *matHeaderCellDef>Opción</th>
            <td mat-cell *matCellDef="let p" [ngClass]="{'override': currentSelectionMap()[p.id] !== globalSelections[currentQuestionId()]}">
              <mat-select [(ngModel)]="currentSelectionMap()[p.id]" placeholder="Opción" aria-label="Seleccionar opción para {{p.shareholderName}}">
                <mat-option *ngFor="let o of getOptionsForCurrentQuestion()" [value]="o.optionId || o.OptionId">{{o.text}}</mat-option>
              </mat-select>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="bulkCols"></tr>
          <tr mat-row *matRowDef="let row; columns: bulkCols;"></tr>
        </table>
        <div class="warn" *ngIf="!canGoNext()">Debes registrar todos los votos antes de continuar.</div>
        <div class="vote-form">
          <button mat-stroked-button (click)="prevQuestion()" [disabled]="currentIndex()===0" aria-label="Pregunta anterior">Anterior</button>
          <button mat-raised-button color="primary" (click)="nextQuestion()" [disabled]="!canGoNext()" aria-label="Siguiente pregunta">{{currentIndex()+1 < results().length ? 'Siguiente' : 'Resumen'}}</button>
        </div>
      </ng-container>
      <ng-template #summaryTpl>
        <h4>Resumen de votos</h4>
        <div *ngFor="let q of results()" class="q">
          <h5>{{q.text}}</h5>
          <div *ngFor="let o of (q.options ?? q.Options)" class="summary-option">{{o.text}}: {{summaryCount(q.questionId || q.QuestionId, o.optionId || o.OptionId)}}</div>
        </div>
        <div class="vote-form">
          <button mat-stroked-button (click)="showSummary.set(false); currentIndex.set(0)">Editar</button>
          <button mat-raised-button color="primary" (click)="submitAll()">Enviar votos</button>
        </div>
      </ng-template>
        <div class="mt8" *ngIf="canClose && !showSummary()">
<button mat-stroked-button color="warn" (click)="closeVoting()" *ngIf="status()==='VotingOpen'">Cerrar votaci�n</button>
          <button mat-stroked-button color="warn" (click)="closeElection()">Cerrar elecci�n</button>
        </div>
    </mat-card>
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
     .full{width:100%}
     .mt8{margin-top:8px}
     table.compact th, table.compact td{ font-size:13px }
     .edit-grid{ display:grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap:12px; align-items:end }
     .actions{ grid-column: 1 / -1; display:flex; gap:8px; justify-content:flex-end }
     .progress{font-weight:600;margin-bottom:8px}
     .override mat-select{background:#fff3cd}
     .summary-option{margin-left:12px}
     .warn{color:#d32f2f;font-size:13px;margin:4px 0}
     .chart-container{max-width:300px;margin-bottom:8px}
     .status-card{margin:12px 0;padding:8px 12px}
     .status-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
     .chip{border-radius:12px;padding:2px 8px;background:#eee}
     .chip.status{background:#e3f2fd}
     .chip.locked{background:#ffcdd2}
     .chip.unlocked{background:#c8e6c9}
     .chip.ok{background:#c8e6c9}
     .chip.warn{background:#ffe0b2}
     .muted{opacity:.8}
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
  padronDS = new MatTableDataSource<PadronRow>([]);
  get padronCols() {
    return this.editMode() && this.canAttend ? ['id','name','shares','attendance'] : ['id','name','shares'];
  }
  assignments = signal<any[]>([]);
  assignCols = ['userId','role','action'];
  resCols = ['text','votes','percent'];
  bulkCols = ['name','shares','vote'];
  results = signal<any[]>([]);
  quorum = signal<{total:number,present:number,quorum:number}|null>(null);
  
  status = signal<string>('Draft');
  statusLocked = signal<boolean>(false);
  electionInfo = signal<any|null>(null);

  padronCtrl = new FormControl<PadronRow | string>('', Validators.required);
  filteredPadron = signal<PadronRow[]>([]);
  currentIndex = signal(0);
  showSummary = signal(false);
  globalSelections: Record<string,string> = {};
  voteSelections: Record<string, Record<string,string>> = {};
  charts: Chart[] = [];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  assignForm = inject(FormBuilder).group({ userId: ['', Validators.required], role: ['', Validators.required] });
  assignmentRoles = ALLOWED_ASSIGNMENT_ROLES;
  signingRequired: boolean = false;

  constructor(){
    this.id.set(this.route.snapshot.params['id']);
    this.editMode.set(this.route.snapshot.queryParamMap.get('mode')==='edit');
    // Join live updates for this election
    this.live.joinElection(this.id());
    // Forzar off si no es admin
    if (this.editMode() && !(this.auth.hasRole('GlobalAdmin') || this.auth.hasRole('VoteAdmin'))) this.editMode.set(false);
    this.loadAssignments();
    this.loadResults();
    this.loadPadron();
    this.loadQuorum();
    this.loadElectionInfo();
    this.http.get<any>(`/api/elections/${this.id()}/status`).subscribe({
      next: s => { const st = (s?.Status ?? s?.status ?? 'Draft'); const lck = !!(s?.Locked ?? s?.locked ?? false); this.status.set(st); this.statusLocked.set(lck); },
      error: _ => {}
    });
    this.live.onVoteRegistered(()=> { this.loadResults(); this.loadQuorum(); });
    this.live.onQuorumUpdated(p => {
      if (p && p.ElectionId === this.id()) {
        this.quorum.set({ total: p.TotalShares, present: p.PresentShares, quorum: p.Quorum });
      }
    });
    if (this.editMode()) this.prefillEdit();
    this.padronCtrl.valueChanges.subscribe(val => {
      const term = (typeof val === 'string' ? val : val?.shareholderName || '').toLowerCase();
      const base = this.padronDS.data.filter((p:PadronRow) => p.attendance === 'Presencial' || p.attendance === 'Virtual');
      this.filteredPadron.set(base.filter((p:PadronRow) => (p.shareholderName || '').toLowerCase().includes(term)));
    });
  }
  ngOnDestroy(){ this.live.leaveElection(this.id()); }
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
    this.http.get<any[]>(`/api/elections/${this.id()}/results`).subscribe({
      next: d => { this.results.set(d as any[]); if(d && d.length){ this.currentIndex.set(0); this.showSummary.set(false); } setTimeout(()=>this.renderCharts(),0); },
      error: err => {
        if (err.status === 400) {
          // Votaci�n abierta: cargar preguntas desde la elecci�n
          this.http.get<any>(`/api/elections/${this.id()}`).subscribe({
            next: e => {
              const qs = (e?.questions ?? e?.Questions ?? []).map((q:any) => ({
                questionId: q.id ?? q.Id,
                text: q.text ?? q.Text,
                options: (q.options ?? q.Options ?? []).map((o:any)=>({ optionId: o.id ?? o.Id, text: o.text ?? o.Text, votes: 0 }))
              }));
              this.results.set(qs);
              if (qs.length) { this.currentIndex.set(0); this.showSummary.set(false); }
              setTimeout(()=>this.renderCharts(),0);
            },
            error: _ => { this.results.set([]); }
          });
        } else {
          this.results.set([]);
          if (err.status === 403) this.snack.open("No autorizado para ver resultados","OK",{duration:2500});
        }
      }
    });
  }
    toggleSigning(state: boolean){
    this.signingRequired = !!state;
    this.http.put(`/api/elections/${this.id()}`, { signingRequired: this.signingRequired }).subscribe({
      next: _=> this.snack.open("Firma requerida actualizada","OK",{duration:1500}),
      error: _=> this.snack.open("No se pudo actualizar firma requerida","OK",{duration:2000})
    });
  }loadElectionInfo(){
    this.http.get<any>(`/api/elections/${this.id()}`).subscribe({
      next: e => this.electionInfo.set(e || null),
      error: _ => this.electionInfo.set(null)
    });
  }

  loadPadron(){
    this.http.get<any[]>(`/api/elections/${this.id()}/padron`).subscribe({
      next: d=> {
        this.padronDS.data = d;
        this.ngAfterViewInit();
        this.filteredPadron.set(this.padronDS.data.filter(p => p.attendance === 'Presencial' || p.attendance === 'Virtual'));
        this.padronCtrl.setValue(this.padronCtrl.value || '');
      },
      error: _=> { this.padronDS.data = []; this.filteredPadron.set([]); }
    });
  }
  loadQuorum(){
    this.http.get<any>(`/api/elections/${this.id()}/quorum`).subscribe({
      next: d=> {
        const q = { total: d.total ?? d.Total, present: d.present ?? d.Present, quorum: d.quorum ?? d.Quorum } as {total:number,present:number,quorum:number};
        this.quorum.set(q);
        if (this.editMode() && (q.present ?? 0) > 0){
          this.editMode.set(false);
          this.snack.open('No se puede editar: ya hay registros de asistencia','OK',{duration:2500});
          this.router.navigate(['/elections', this.id()]);
        }
      },
      error: _=> this.quorum.set(null)
    });
  }
  setAtt(padronId: string, att: 'None'|'Virtual'|'Presencial'){
    this.http.post(`/api/elections/${this.id()}/padron/${padronId}/attendance`, { attendance: att }).subscribe({
      next: _=> { this.snack.open('Asistencia actualizada','OK',{duration:1500}); this.loadPadron(); this.loadQuorum(); },
      error: _=> this.snack.open('Error al actualizar','OK',{duration:2000})
    });
  }

  // Edit support methods
  prefillEdit(){
    this.http.get<any>(`/api/elections/${this.id()}`).subscribe({ next: (e:any) => {
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
    const dto:any = { name: v.name, scheduledAt: out.toISOString(), quorumMinimo: Math.min(1, Math.max(0, (v.quorumPct||0)/100)) };
    this.http.put(`/api/elections/${this.id()}`, dto).subscribe({ next: _=> { this.snack.open('Elección actualizada','OK',{duration:1500}); this.router.navigate(['/elections', this.id()]); this.editMode.set(false); this.loadQuorum(); }, error: _=> this.snack.open('Error al actualizar','OK',{duration:2000}) });
  }
  cancelEdit(){ this.router.navigate(['/elections', this.id()]); this.editMode.set(false); }

  currentQuestionId(){ return this.results()[this.currentIndex()]?.questionId ?? this.results()[this.currentIndex()]?.QuestionId; }
  currentQuestion(){ return this.results()[this.currentIndex()]; }
  getOptionsForCurrentQuestion(){ return this.currentQuestion()?.options ?? this.currentQuestion()?.Options ?? []; }
  currentSelectionMap(){ const qId = this.currentQuestionId(); return this.voteSelections[qId] || (this.voteSelections[qId] = {}); }
  applyAll(optionId: string){ const map = this.currentSelectionMap(); this.globalSelections[this.currentQuestionId()] = optionId; for (const p of this.filteredPadron()) map[p.id] = optionId; }
  canGoNext(){ const map = this.currentSelectionMap(); return this.filteredPadron().every(p => !!map[p.id]); }
  nextQuestion(){ if (!this.canGoNext()){ this.snack.open('Faltan votos por registrar','OK',{duration:2500}); return; } if (this.currentIndex() < this.results().length - 1) this.currentIndex.update(i=>i+1); else this.showSummary.set(true); }
  prevQuestion(){ if (this.currentIndex() > 0) this.currentIndex.update(i=>i-1); }
  summaryCount(qId:string, optionId:string){ const map = this.voteSelections[qId] || {}; return Object.values(map).filter(v=>v===optionId).length; }
  renderCharts(){
    this.charts.forEach(c=>c.destroy());
    this.charts = [];
    this.results().forEach((q:any, idx:number) => {
      const canvas = document.getElementById(`res-chart-${idx}`) as HTMLCanvasElement | null;
      if (!canvas) return;
      const opts = q.options ?? q.Options ?? [];
      const labels = opts.map((o:any)=>o.text);
      const data = opts.map((o:any)=>o.votes);
      const colors = labels.map((_:any,i:number)=>`hsl(${(i*60)%360},70%,70%)`);
      this.charts.push(new Chart(canvas,{type:'pie', data:{labels, datasets:[{data, backgroundColor:colors}]}}));
    });
  }
  submitAll(){
    const votes:any[] = [];
    for (const q of this.results()){
      const qId = q.questionId || q.QuestionId;
      const map = this.voteSelections[qId] || {};
      for (const pid of Object.keys(map)) votes.push({ padronId: pid, questionId: qId, optionId: map[pid] });
    }
    if (!votes.length){ this.snack.open('No hay votos para registrar','OK',{duration:2000}); return; }
    const onSuccess = () => { this.snack.open('Votos registrados','OK',{duration:1500}); this.loadResults(); this.voteSelections = {}; this.globalSelections = {}; this.showSummary.set(false); this.currentIndex.set(0); };
    this.http.post(`/api/elections/${this.id()}/votes/batch`, { votes }).subscribe({
      next: _=> onSuccess(),
      error: err => {
        if (err.status === 501){
          const calls = votes.map(v => this.http.post(`/api/elections/${this.id()}/votes`, v));
          forkJoin(calls).subscribe({
            next: _=> onSuccess(),
            error: _=> this.snack.open('Error al registrar voto','OK',{duration:2500})
          });
        }
        else if (err.status === 404) this.snack.open('Elección no encontrada','OK',{duration:2500});
        else if (err.status === 400) this.snack.open('Quórum no alcanzado o elección cerrada','OK',{duration:2500});
        else if (err.status === 403) this.snack.open('No tienes permiso para registrar','OK',{duration:2500});
        else this.snack.open('Error al registrar voto','OK',{duration:2500});
      }
    });
  }
  closeElection(){
    this.http.post(`/api/elections/${this.id()}/close`, {}).subscribe({
      next: _=> { this.snack.open('Elección cerrada','OK',{duration:2000}); this.loadResults(); this.loadElectionInfo(); },
      error: _=> this.snack.open('No autorizado para cerrar','OK',{duration:2500})
    });
  }
  applyFilter(ev: Event){
    const v = (ev.target as HTMLInputElement)?.value ?? '';
    this.padronDS.filter = v.trim().toLowerCase();
  }

  get canAttend(){
    if (this.auth.hasRole('GlobalAdmin') || this.auth.hasRole('VoteAdmin')) return true;
    const me = this.auth.payload?.sub;
    return (this.assignments()||[]).some((a:any) => (a.userId ?? a.UserId) === me && (a.role ?? a.Role) === Roles.AttendanceRegistrar);
  }
  get canRegister(){
    if (this.electionInfo()?.isClosed) return false;
    const admin = this.auth.hasRole('GlobalAdmin') || this.auth.hasRole('VoteAdmin');
    if (!admin && this.status() !== "VotingOpen") return false;
    if (admin) return true;
    const me = this.auth.payload?.sub;
    return (this.assignments()||[]).some((a:any) => (a.userId ?? a.UserId) === me && (a.role ?? a.Role) === Roles.VoteRegistrar);
  }
    get canClose(){ return this.auth.hasRole('GlobalAdmin') || this.auth.hasRole('VoteAdmin'); }

  closeVoting(){
    this.http.post('/api/elections/' + this.id() + '/status/close-voting', { confirm: true }).subscribe({
      next: _=> { this.snack.open('Votaci�n cerrada','OK',{duration:2000}); this.loadResults(); this.loadQuorum(); },
      error: err => {
        if (err?.error?.error === 'incomplete_votes') this.snack.open('Faltan votos de presentes en alguna pregunta','OK',{duration:2500});
        else this.snack.open('No se pudo cerrar la votaci�n','OK',{duration:2500});
      }
    });
  }
}

