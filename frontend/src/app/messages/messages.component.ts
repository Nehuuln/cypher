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

  // Helper: build avatar URL for a conversation (avoids complex template expressions)
  avatarForConversation(conv: any): string {
    if (!conv?.participants?.length) return '';
    // find the other participant (not current user)
    const other = conv.participants.find((p: any) => String(p._id) !== String(this.currentUser?._id));
    const id = other?._id || conv.participants[0]._id;
    return `${this.baseUrl}/api/users/${id}/avatar`;
  }

  // Helper: names of participants excluding current user
  participantNames(conv: any): string {
    if (!conv?.participants?.length) return '';
    return conv.participants
      .map((p: any) => p.username)
      .filter((u: string) => u !== this.currentUser?.username)
      .join(', ');
  }

  // Active conversation avatar shortcut
  avatarForActiveConv(): string {
    return this.avatarForConversation(this.activeConv);
  }
}