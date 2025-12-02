import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessagesService } from './messages.service';
import { AuthService } from '../auth/auth.service';
import { FormsModule } from '@angular/forms';
import { MessageInputComponent } from './message-input.component';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule, MessageInputComponent],
  templateUrl: './messages.component.html',
  styles: []
})
export class MessagesComponent implements OnInit {
  conversations: any[] = [];
  activeConv: any = null;
  currentUser: any = null;
  loading = false;
  private baseUrl = 'https://localhost:3000';

  constructor(private svc: MessagesService, private auth: AuthService) {}

  ngOnInit() {
    this.auth.currentUser$.subscribe(u => {
      this.currentUser = u;
      if (u) this.svc.identify(u._id ?? u.id);
    });
    this.loadConversations();
    this.svc.updates$.subscribe(u => {
      if (!u) return;
      if (String(u.conversationId) === String(this.activeConv?._id)) {
        this.loadActiveConversation(this.activeConv._id);
      } else {
        this.loadConversations();
      }
    });
  }

  private getEntityId(entity: any): string | null {
    if (!entity) return null;
    if (typeof entity === 'string') return entity;
    return entity._id ?? entity.id ?? null;
  }

  loadConversations() {
    this.svc.listConversations().subscribe(res => {
      this.conversations = res.conversations ?? [];
    });
  }

  openConversation(convId: string) {
    this.loadActiveConversation(convId);
  }

  loadActiveConversation(convId: string) {
    this.loading = true;
    this.svc.getConversation(convId).subscribe(res => {
      this.activeConv = res.conversation;
      this.loading = false;
    }, () => this.loading = false);
  }

  startNewMessage() {
    const userId = prompt('User ID to message (quick):');
    if (!userId) return;
    this.svc.startConversation(userId).subscribe(res => {
      this.openConversation(res.conversationId);
      this.loadConversations();
    });
  }

  onSendFromInput(ev: any) {
    const { text, files } = ev;
    if (!this.activeConv) return;
    this.svc.sendMessage(this.activeConv._id, text, files).subscribe(() => {
      this.loadActiveConversation(this.activeConv._id);
      this.loadConversations();
    });
  }

  avatarForConversation(conv: any): string {
    if (!conv?.participants?.length) return '';
    const other = conv.participants.find((p: any) => {
      const pid = this.getEntityId(p);
      const meId = this.getEntityId(this.currentUser);
      return pid && meId ? String(pid) !== String(meId) : !!pid;
    });
    const id = this.getEntityId(other) || this.getEntityId(conv.participants[0]);
    return id ? `${this.baseUrl}/api/users/${id}/avatar` : '';
  }

  avatarUrlForUser(user: any): string {
    const id = this.getEntityId(user);
    return id ? `${this.baseUrl}/api/users/${id}/avatar` : '';
  }

  participantNames(conv: any): string {
    if (!conv?.participants?.length) return '';
    const meUsername = this.currentUser?.username;
    const usernames = conv.participants
      .map((p: any) => (p && typeof p === 'object' ? p.username : null))
      .filter((u: string | null) => !!u && u !== meUsername)
      .map((u: string) => u!.trim());

    return usernames.join(', ');
  }

  avatarForActiveConv(): string {
    return this.avatarForConversation(this.activeConv);
  }

  attachmentUrl(convId: string, filename?: string): string {
    if (!convId) return '';
    const base = `${this.baseUrl}/api/messages/${convId}/attachments`;
    return filename ? `${base}/${encodeURIComponent(filename)}` : `${base}/`;
  }

  // new helpers
  isImage(a: any): boolean {
    return !!(a && a.contentType && String(a.contentType).startsWith('image/'));
  }
  isVideo(a: any): boolean {
    return !!(a && a.contentType && String(a.contentType).startsWith('video/'));
  }
  isPdf(a: any): boolean {
    return !!(a && a.contentType && String(a.contentType) === 'application/pdf');
  }

  onAvatarError(event: any) {
    event.target.src = 'assets/default-avatar.png';
  }
}