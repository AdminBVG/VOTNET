import { Component } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-election-create',
  templateUrl: './election-create.component.html',
  styleUrls: ['./election-create.component.css']
})
export class ElectionCreateComponent {
  form: FormGroup;
  padron?: File;

  constructor(private fb: FormBuilder, private http: HttpClient, private router: Router) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      details: [''],
      scheduledAt: ['', Validators.required],
      quorumMinimo: [0, [Validators.required, Validators.min(0)]],
      questions: this.fb.array([
        this.fb.group({
          text: ['', Validators.required],
          options: this.fb.array([
            this.fb.control('', Validators.required)
          ])
        })
      ])
    });
  }

  get questions(): FormArray {
    return this.form.get('questions') as FormArray;
  }

  options(i: number): FormArray {
    return this.questions.at(i).get('options') as FormArray;
  }

  addQuestion(): void {
    this.questions.push(this.fb.group({ text: '', options: this.fb.array([]) }));
  }

  addOption(q: number): void {
    this.options(q).push(this.fb.control('', Validators.required));
  }

  onFileChange(event: any): void {
    this.padron = event.target.files[0];
  }

  submit(): void {
    if (this.form.invalid) return;
    const election = this.form.value;
    this.http.post<any>(`${environment.apiBaseUrl}/elections`, election).subscribe(e => {
      if (this.padron) {
        const formData = new FormData();
        formData.append('file', this.padron);
        this.http.post(`${environment.apiBaseUrl}/elections/${e.id}/padron`, formData).subscribe(() => {
          this.router.navigate(['/elections']);
        });
      } else {
        this.router.navigate(['/elections']);
      }
    });
  }
}
