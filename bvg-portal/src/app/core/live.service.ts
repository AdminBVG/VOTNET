import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';

@Injectable({ providedIn: 'root' })
export class LiveService {
  private connection: signalR.HubConnection;

  constructor(){
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/live', {
        accessTokenFactory: () => {
          const raw = localStorage.getItem('token');
          if (!raw) return '';
          try { return JSON.parse(raw); } catch { return raw; }
        }
      })
      .withAutomaticReconnect()
      .build();

    this.connection.start().catch(() => {/* ignore for now */});
  }

  onVoteRegistered(handler: (payload: any) => void){
    this.connection.on('voteRegistered', handler);
  }

  onAttendanceUpdated(handler: (payload: { ElectionId:string; PadronId:string; Attendance:string }) => void){
    this.connection.on('attendanceUpdated', handler as any);
  }

  onAttendanceSummary(handler: (payload: { ElectionId:string; Total:number; Presencial:number; Virtual:number; Ausente:number }) => void){
    this.connection.on('attendanceSummary', handler as any);
  }

  onQuorumUpdated(handler: (payload: { ElectionId:string; TotalShares:number; PresentShares:number; Quorum:number }) => void){
    this.connection.on('quorumUpdated', handler as any);
  }

  onActaUploaded(handler: (payload: { ElectionId:string; PadronId:string; Url:string }) => void){
    this.connection.on('actaUploaded', handler as any);
  }

  onAttendanceLockChanged(handler: (payload: { ElectionId:string; Locked:boolean }) => void){
    this.connection.on('attendanceLockChanged', handler as any);
  }
}
