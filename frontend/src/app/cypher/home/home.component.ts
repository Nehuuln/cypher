import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './home.component.html',
  styles: [`
    .post { padding: 12px; border-bottom: 1px solid #eee; }
    .author-line { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .avatar { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; background: #ddd; }
    .author-meta { font-size: 0.95rem; }
    .text { margin: 8px 0 12px 0; }
  `]
})
export class HomeComponent implements OnInit {
  posts: any[] = [];
  loading = true;
  error: string | null = null;
  private baseUrl = 'https://localhost:3000';

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.http.get<any>(`${this.baseUrl}/api/posts`).subscribe({
      next: (res) => { this.posts = res.posts ?? []; this.loading = false; },
      error: (err) => { this.error = err?.error?.message || 'Erreur'; this.loading = false; }
    });
  }

  mediaUrl(post: any) {
    return `${this.baseUrl}/api/posts/${post._id}/media`;
  }

  avatarUrl(user: any) {
    if (!user || !user._id) return '';
    return `${this.baseUrl}/api/users/${user._id}/avatar`;
  }

  onAvatarError(ev: Event) {
    const img = ev.target as HTMLImageElement;
    img.style.display = 'none';
  }
}