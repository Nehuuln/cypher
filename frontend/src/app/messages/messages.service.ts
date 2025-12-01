import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MessagesService implements OnDestroy {
  private base = 'https://localhost:3000';
  private socket: Socket | null = null;
  public updates$ = new BehaviorSubject<any | null>(null);

  constructor(private http: HttpClient) {
    this.connectSocket();
  }

  private connectSocket() {
    try {
      this.socket = io(this.base, { transports: ['websocket'], secure: true });
      this.socket.on('connect', () => {
        // identification done from component via identify(userId)
      });
      this.socket.on('message:new', (data: any) => {
        this.updates$.next(data);
      });
    } catch (e) {
      console.error('Socket connect error', e);
    }
  }

  identify(userId: string) {
    if (this.socket && userId) this.socket.emit('identify', userId);
  }

  listConversations() {
    return this.http.get<any>(`${this.base}/api/messages`, { withCredentials: true });
  }

  startConversation(userId: string) {
    return this.http.post<any>(`${this.base}/api/messages/start`, { userId }, { withCredentials: true });
  }

  getConversation(convId: string) {
    return this.http.get<any>(`${this.base}/api/messages/${convId}`, { withCredentials: true });
  }

  sendMessage(convId: string, text: string, files?: File[]) {
    const fd = new FormData();
    fd.append('text', text || '');
    if (files) {
      for (const f of files) fd.append('attachments', f, f.name);
    }
    return this.http.post<any>(`${this.base}/api/messages/${convId}`, fd, { withCredentials: true });
  }

  ngOnDestroy() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}