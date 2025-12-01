import { Component, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-message-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="input-container" style="display:flex; gap:10px; align-items:center;">
      <label class="file-btn" style="cursor:pointer; color:var(--primary-color);">
        <input type="file" (change)="onFiles($event)" multiple style="display:none;" />
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path
            d="M3 5.5C3 4.12 4.12 3 5.5 3h13C19.88 3 21 4.12 21 5.5v13c0 1.38-1.12 2.5-2.5 2.5h-13C4.12 21 3 19.88 3 18.5v-13zM5.5 5c-.28 0-.5.22-.5.5v13c0 .28.22.5.5.5h13c.28 0 .5-.22.5-.5v-13c0-.28-.22-.5-.5-.5h-13zM16 10.5l-3.5 4.5-2-2.5L7 17h10l-1-6.5z"
          />
        </svg>
      </label>

      <input
        name="text"
        [(ngModel)]="text"
        placeholder="Écrire un message..."
        style="flex:1; padding:10px 15px; border-radius:20px; border:1px solid var(--border-color); background-color: var(--bg-color); outline:none; font-size:15px;"
        (keydown.enter)="sendNow()"
      />

      <button
        (click)="sendNow()"
        [disabled]="!text && files.length === 0"
        style="background:none; border:none; color:var(--primary-color); cursor:pointer; padding:5px;"
      >
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="currentColor"
          style="transform: rotate(-45deg); margin-left:-2px; margin-top:2px;"
        >
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
    </div>

    <div
      *ngIf="files.length"
      style="font-size:12px; color:var(--primary-color); margin-top:5px; margin-left:40px;"
    >
      {{ files.length }} fichier(s) joint(s)
    </div>
  `,
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
