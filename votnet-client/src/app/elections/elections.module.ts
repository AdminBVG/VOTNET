import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatStepperModule } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ReactiveFormsModule } from '@angular/forms';
import { ElectionListComponent } from './election-list.component';
import { ElectionCreateComponent } from './election-create.component';
import { ResultsComponent } from './results/results.component';

const routes: Routes = [
  { path: '', component: ElectionListComponent },
  { path: 'create', component: ElectionCreateComponent },
  { path: ':id/results', component: ResultsComponent }
];

@NgModule({
  declarations: [ElectionListComponent, ElectionCreateComponent, ResultsComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    MatTableModule,
    MatButtonModule,
    MatStepperModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    ReactiveFormsModule
  ]
})
export class ElectionsModule {}
