import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { take } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { Location } from '@angular/common';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit {
  user: any = null;
  posts: any[] = [];
  loading = true;
  loadingPosts = false;
  error: string | null = null;
  private baseUrl = 'https://localhost:3000';

  selectedFile: File | null = null;
  avatarUrl: string | null = null;

  isMyProfile = false;

  constructor(
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private location: Location
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      this.auth.currentUser$.pipe(take(1)).subscribe((cur) => {
        if (!cur) {
          this.auth
            .me()
            .pipe(take(1))
            .subscribe({
              next: (res) => this.handleMe(res?.user ?? res, id),
              error: () => this.router.navigate(['/login']),
            });
        } else {
          this.handleMe(cur, id);
        }
      });
    });
  }

  private handleMe(currentUser: any, requestedId: string | null) {
    const myId = currentUser?._id ?? currentUser?.id;
    const roles = Array.isArray(currentUser?.roles) ? currentUser.roles : [];
    const isAdmin = roles.some((r: string) => String(r).toLowerCase() === 'admin');

    if (!requestedId) {
      this.error = 'ID manquant';
      this.loading = false;
      return;
    }
    this.isMyProfile = String(myId) === String(requestedId);
    this.http
      .get<any>(`${this.baseUrl}/api/users/${requestedId}`, { withCredentials: true })
      .subscribe({
        next: (res) => {
          this.user = res.user;
          this.loading = false;
          this.loadAvatar(requestedId);
          this.loadUserPosts(requestedId);
        },
        error: (err) => {
          this.error = err?.error?.message || 'Erreur';
          this.loading = false;
        },
      });
  }

  loadUserPosts(userId: string) {
    this.loadingPosts = true;
    this.http.get<any>(`${this.baseUrl}/api/posts/user/${userId}`).subscribe({
      next: (res) => {
        this.posts = res.posts || [];
        this.loadingPosts = false;
      },
      error: () => (this.loadingPosts = false),
    });
  }

  triggerAvatarUpload() {
    if (!this.isMyProfile) return;
    document.getElementById('avatarInput')?.click();
  }

  onFileSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    if (input.files && input.files.length) {
      this.selectedFile = input.files[0];
      this.uploadAvatar();
    }
  }

  uploadAvatar() {
    if (!this.selectedFile || !this.user) return;
    const form = new FormData();
    form.append('avatar', this.selectedFile);
    this.http
      .put<any>(`${this.baseUrl}/api/users/${this.user._id}`, form, { withCredentials: true })
      .subscribe({
        next: (res) => {
          this.user = res.user;
          this.selectedFile = null;
          this.loadAvatar(this.user._id);
        },
        error: (err) => {
          this.error = err?.error?.message || 'Erreur upload';
        },
      });
  }

  loadAvatar(userId: string) {
    this.http
      .get(`${this.baseUrl}/api/users/${userId}/avatar`, {
        responseType: 'blob',
        withCredentials: true,
      })
      .subscribe({
        next: (blob) => {
          if (this.avatarUrl) URL.revokeObjectURL(this.avatarUrl);
          this.avatarUrl = URL.createObjectURL(blob);
        },
        error: () => {
          this.avatarUrl = null;
        },
      });
  }

  goBack() {
    this.location.back();
  }

  mediaUrl(post: any) {
    return `${this.baseUrl}/api/posts/${post._id}/media`;
  }

  getPostAvatarUrl(author: any): string {
    return `${this.baseUrl}/api/users/${author._id}/avatar`;
  }
}
