import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-create-post',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  templateUrl: './create-post.component.html'
})
export class CreatePostComponent {
  text = '';
  selectedFile: File | null = null;
  error: string | null = null;
  loading = false;
  private baseUrl = 'https://localhost:3000';

  constructor(private http: HttpClient, private router: Router, private auth: AuthService) {}

  onFileSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    this.error = null;
    this.selectedFile = input.files && input.files.length ? input.files[0] : null;

    if (this.selectedFile) {
      const allowedExt = ['image/jpeg','image/png','video/mp4','video/webm','video/quicktime'];
      if (!allowedExt.includes(this.selectedFile.type)) {
        this.error = 'Type de fichier non autorisé.';
        this.selectedFile = null;
      }
      // If video, check duration client-side
      if (this.selectedFile && this.selectedFile.type.startsWith('video/')) {
        const url = URL.createObjectURL(this.selectedFile);
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.onloadedmetadata = () => {
          URL.revokeObjectURL(url);
          if (v.duration > 60) {
            this.error = 'La vidéo doit faire au maximum 1 minute.';
            this.selectedFile = null;
          }
        };
        v.src = url;
      }
    }
  }

  submit() {
    this.error = null;
    if (!this.text && !this.selectedFile) {
      this.error = 'Rédigez du texte ou joignez un média.';
      return;
    }
    this.loading = true;
    const form = new FormData();
    form.append('text', this.text);
    if (this.selectedFile) form.append('media', this.selectedFile);
    this.http.post<any>(`${this.baseUrl}/api/posts`, form, { withCredentials: true }).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/']); // go home to see post
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Erreur lors de la publication';
      }
    });
  }
}