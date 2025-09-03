import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-vote-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, NgIf],
  template: `
    <h2 mat-dialog-title>Confirmar voto</h2>
    <div mat-dialog-content>
      <p><b>Accionista:</b> {{data.shareholder.shareholderName}}</p>
      <p><b>Pregunta:</b> {{data.question.text}}</p>
      <p><b>Opción:</b> {{data.option.text}}</p>
    </div>
    <div mat-dialog-actions>
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-raised-button color="primary" [mat-dialog-close]="true">Confirmar</button>
    </div>
  `
})
export class VoteConfirmDialogComponent {
  data = inject(MAT_DIALOG_DATA);
}

