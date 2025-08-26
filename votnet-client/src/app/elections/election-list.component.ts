import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';

@Component({
  selector: 'app-election-list',
  templateUrl: './election-list.component.html'
})
export class ElectionListComponent {
  displayedColumns = ['name', 'actions'];
  elections: any[] = [];

  constructor(private http: HttpClient, private router: Router) {
    this.load();
  }

  load(): void {
    this.http.get<any[]>(`${environment.apiBaseUrl}/elections`).subscribe(data => this.elections = data);
  }

  create(): void {
    this.router.navigate(['/elections/create']);
  }

  results(id: string): void {
    this.router.navigate(['/elections', id, 'results']);
  }
}
