import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth/auth.service';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-profile-public',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule, RouterModule],
  templateUrl: './profile-public.component.html',
})
export class ProfilePublicComponent implements OnInit {
  profile: any = null;
  posts: any[] = [];
  avatarUrl: string | null = null;
  tagInput = '';
  loading = false;
  error: string | null = null;
  likeProcessing: Record<string, boolean> = {};

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
    this.posts = [];
    this.avatarUrl = null;

    this.http.get<any>(`${this.baseUrl}/api/users/tag/${encodeURIComponent(tag)}`).subscribe({
      next: (res) => {
        this.profile = res.user;
        if (this.profile?._id) {
          this.avatarUrl = `${this.baseUrl}/api/users/${this.profile._id}/avatar`;
          this.loadUserPosts(this.profile._id);
        } else {
          this.loading = false;
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Utilisateur introuvable';
      },
    });
  }

  loadUserPosts(userId: string) {
    this.http.get<any>(`${this.baseUrl}/api/posts/user/${userId}`).subscribe({
      next: (res) => {
        this.posts = res.posts || [];
        if (this.currentUser) {
          const me = this.currentUser._id ?? this.currentUser.id;
          this.posts.forEach(
            (p) => (p.likedByMe = (p.likes || []).some((x: any) => String(x) === String(me)))
          );
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading user posts', err);
        this.loading = false;
      },
    });
  }

  mediaUrl(post: any) {
    return `${this.baseUrl}/api/posts/${post._id}/media`;
  }

  userAvatarUrl(user: any) {
    if (!user || !user._id) return '';
    return `${this.baseUrl}/api/users/${user._id}/avatar`;
  }

  isLikedByMe(post: any): boolean {
    if (post.likedByMe !== undefined) return post.likedByMe;
    if (!this.currentUser) return false;
    const me = this.currentUser._id ?? this.currentUser.id;
    return (post.likes || []).some((x: any) => String(x) === String(me));
  }

  toggleLike(post: any) {
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }
    const postId = post._id;
    this.likeProcessing[postId] = true;
    const meLiked = this.isLikedByMe(post);
    const url = `${this.baseUrl}/api/posts/${postId}/${meLiked ? 'unlike' : 'like'}`;

    this.http.post<any>(url, {}, { withCredentials: true, observe: 'response' }).subscribe({
      next: (res) => {
        post.likesCount = res.body?.likesCount ?? post.likesCount;
        post.likedByMe = !meLiked;
        this.likeProcessing[postId] = false;
      },
      error: (err) => {
        this.likeProcessing[postId] = false;
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
