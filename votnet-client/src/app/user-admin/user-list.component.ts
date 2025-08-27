import { Component, Inject } from '@angular/core';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html'
})
export class UserListComponent {
  displayedColumns = ['username'];
  users: any[] = [];

  constructor(private http: HttpClient, private dialog: MatDialog) {
    this.load();
  }

  load(): void {
    this.http.get<any[]>(`${environment.apiBaseUrl}/users`).subscribe(data => this.users = data);
  }

  create(): void {
    const ref = this.dialog.open(UserDialogComponent);
    ref.afterClosed().subscribe(result => {
      if (result) {
        this.load();
      }
    });
  }
}

@Component({
  selector: 'app-user-dialog',
  template: `
  <h1 mat-dialog-title>New User</h1>
  <div mat-dialog-content>
    <form [formGroup]="form">
      <mat-form-field>
        <mat-label>Username</mat-label>
        <input matInput formControlName="username" />
      </mat-form-field>
      <mat-form-field>
        <mat-label>Password</mat-label>
        <input matInput type="password" formControlName="password" />
      </mat-form-field>
    </form>
  </div>
  <div mat-dialog-actions>
    <button mat-button (click)="dialogRef.close()">Cancel</button>
    <button mat-raised-button color="primary" (click)="save()">Save</button>
  </div>`
})
export class UserDialogComponent {
  form: FormGroup;

  constructor(private fb: FormBuilder, private http: HttpClient, public dialogRef: MatDialogRef<UserDialogComponent>) {
    this.form = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.http.post(`${environment.apiBaseUrl}/users`, this.form.value).subscribe(() => this.dialogRef.close(true));
  }
}
