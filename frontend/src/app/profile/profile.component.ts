import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { take } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit {
  user: any = null;
  loading = true;
  error: string | null = null;
  private baseUrl = 'https://localhost:3000';
  selectedFile: File | null = null;
  avatarUrl: string | null = null;

  constructor(
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    // ensure we have the current user
    this.auth.currentUser$.pipe(take(1)).subscribe((cur) => {
      if (!cur) {
        // fetch me(), then check
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
  }

  private handleMe(currentUser: any, requestedId: string | null) {
    const myId = currentUser?._id ?? currentUser?.id ?? currentUser?.id;
    const roles = Array.isArray(currentUser?.roles) ? currentUser.roles : [];
    const isAdmin = roles.some((r: string) => String(r).toLowerCase() === 'admin');

    if (!requestedId) {
      this.error = 'ID manquant';
      this.loading = false;
      return;
    }

    if (String(myId) !== String(requestedId) && !isAdmin) {
      // client-side reject; server also enforces
      this.error = 'Accès refusé';
      this.loading = false;
      setTimeout(() => this.router.navigate(['/']), 1200);
      return;
    }

    // fetch profile from API (server will also check)
    this.http
      .get<any>(`${this.baseUrl}/api/users/${requestedId}`, { withCredentials: true })
      .subscribe({
        next: (res) => {
          this.user = res.user;
          this.loading = false;
          this.loadAvatar(requestedId);
        },
        error: (err) => {
          this.error = err?.error?.message || 'Erreur';
          this.loading = false;
        },
      });
  }

  onFileSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    if (input.files && input.files.length) {
      this.selectedFile = input.files[0];
    } else {
      this.selectedFile = null;
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
}
