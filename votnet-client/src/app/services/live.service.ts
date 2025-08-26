import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../environments/environment';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LiveService {
  private hub = new signalR.HubConnectionBuilder()
    .withUrl(environment.apiBaseUrl.replace('/api', '') + '/hubs/live')
    .withAutomaticReconnect()
    .build();

  quorumUpdated = new Subject<any>();
  voteRegistered = new Subject<any>();

  constructor() {
    this.hub.on('quorumUpdated', data => this.quorumUpdated.next(data));
    this.hub.on('voteRegistered', data => this.voteRegistered.next(data));
    this.hub.start().catch(err => console.error(err));
  }
}
