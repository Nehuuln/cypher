import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MessagesService implements OnDestroy {
  private base = 'https://localhost:3000';
  private socket: Socket | null = null;
  public updates$ = new BehaviorSubject<any | null>(null);
  // incoming conversation requests
  public requests$ = new BehaviorSubject<any | null>(null);

  constructor(private http: HttpClient) {
    this.connectSocket();
  }

  private connectSocket() {
    try {
      this.socket = io(this.base, { transports: ['websocket'], secure: true });
      this.socket.on('connect', () => {
        console.log('Socket connected (client) id=', this.socket?.id);
        // identification done from component via identify(userId)
      });
      this.socket.on('message:new', (data: any) => {
        this.updates$.next(data);
      });

      // conversation request arrived
      this.socket.on('conversation:request', (data: any) => {
        console.log('Socket event conversation:request received', data);
        this.requests$.next(data);
      });

      this.socket.on('conversation:accepted', (data: any) => {
        this.updates$.next({ type: 'conversation:accepted', data });
      });

      this.socket.on('conversation:rejected', (data: any) => {
        this.updates$.next({ type: 'conversation:rejected', data });
      });
    } catch (e) {
      console.error('Socket connect error', e);
    }
  }

  acceptConversation(convId: string) {
    return this.http.post<any>(`${this.base}/api/messages/${convId}/accept`, {}, { withCredentials: true });
  }

  rejectConversation(convId: string) {
    return this.http.post<any>(`${this.base}/api/messages/${convId}/reject`, {}, { withCredentials: true });
  }

  identify(userId: string) {
    if (this.socket && userId) {
      console.log('Emitting identify for userId=', userId);
      this.socket.emit('identify', userId);
    }
  }

  listConversations() {
    return this.http.get<any>(`${this.base}/api/messages`, { withCredentials: true });
  }

  startConversation(tag: string) {
    return this.http.post<any>(`${this.base}/api/messages/start`, { tag }, { withCredentials: true });
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