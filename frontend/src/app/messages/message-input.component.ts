import { Component, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-message-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div style="display:flex;gap:.5rem;align-items:center">
      <input name="text" [(ngModel)]="text" placeholder="Écrire un message..." style="flex:1;padding:.6rem;border-radius:8px;border:1px solid #e5e7eb" />
      <input type="file" (change)="onFiles($event)" multiple />
      <button (click)="sendNow()" class="btn-pill" [disabled]="!text && files.length===0">Envoyer</button>
    </div>
  `
})
export class MessageInputComponent {
  text = '';
  files: File[] = [];
  @Output() send = new EventEmitter<any>();

  onFiles(ev: any) {
    const input = ev.target as HTMLInputElement;
    this.files = input.files ? Array.from(input.files) : [];
  }

  sendNow() {
    this.send.emit({ text: this.text, files: this.files });
    this.text = '';
    this.files = [];
  }
}