import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { LiveService } from '../../services/live.service';

@Component({
  selector: 'app-results',
  templateUrl: './results.component.html'
})
export class ResultsComponent implements OnInit {
  results: any;

  constructor(private route: ActivatedRoute, private http: HttpClient, live: LiveService) {
    live.quorumUpdated.subscribe(() => this.load());
    live.voteRegistered.subscribe(() => this.load());
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.http.get<any>(`${environment.apiBaseUrl}/elections/${id}/results`).subscribe(res => {
      res.questions.forEach((q: any) => {
        q.totalVotes = q.options.reduce((s: number, o: any) => s + o.votes, 0);
      });
      this.results = res;
    });
  }
}
