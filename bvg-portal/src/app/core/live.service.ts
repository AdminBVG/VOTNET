import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';

@Injectable({ providedIn: 'root' })
export class LiveService {
  private connection: signalR.HubConnection;

  constructor(){
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/live', {
        accessTokenFactory: () => localStorage.getItem('token') ?? ''
      })
      .withAutomaticReconnect()
      .build();

    this.connection.start().catch(() => {/* ignore for now */});
  }

  onVoteRegistered(handler: (payload: any) => void){
    this.connection.on('voteRegistered', handler);
  }
}
