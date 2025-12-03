import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-profile-public',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule, RouterModule],
  templateUrl: './profile-public.component.html',
})
export class ProfilePublicComponent implements OnInit {
  profile: any = null;
  avatarUrl: string | null = null;
  tagInput = '';
  loading = false;
  error: string | null = null;
  private baseUrl = 'https://localhost:3000';

  currentUser: any = null;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService
  ) {
    this.auth.currentUser$.subscribe((u) => (this.currentUser = u));
  }

  ngOnInit() {
    const paramTag = this.route.snapshot.paramMap.get('tag');
    if (paramTag) {
      this.tagInput = paramTag;
      this.viewByTag();
    }
  }

  viewByTag() {
    const tag = (this.tagInput || '').toString().trim();
    if (!tag) {
      this.error = 'Veuillez indiquer un tag.';
      return;
    }
    this.error = null;
    this.loading = true;
    this.profile = null;
    this.avatarUrl = null;

    this.http.get<any>(`${this.baseUrl}/api/users/tag/${encodeURIComponent(tag)}`).subscribe({
      next: (res) => {
        this.profile = res.user;
        this.loading = false;
        if (this.profile?._id) {
          this.avatarUrl = `${this.baseUrl}/api/users/${this.profile._id}/avatar`;
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Utilisateur introuvable';
      },
    });
  }

  isOwner(): boolean {
    if (!this.currentUser || !this.profile) return false;
    const me = this.currentUser._id ?? this.currentUser.id;
    return String(me) === String(this.profile._id);
  }

  editProfile() {
    if (!this.profile?._id) return;
    this.router.navigate(['/profil/user', this.profile._id]);
  }
}
