import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { of } from 'rxjs';
import { catchError, switchMap, take } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule, RouterModule],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  posts: any[] = [];
  loading = false;
  error: string | null = null;
  newComment: Record<string, string> = {};
  likeProcessing: Record<string, boolean> = {};
  selectedPostForComments: any = null;
  currentUser: any = null;
  private baseUrl = 'https://localhost:3000';

  constructor(private http: HttpClient, private router: Router, private auth: AuthService) {}

  ngOnInit() {
    this.auth.currentUser$
      .pipe(
        take(1),
        switchMap((u) => (u ? of(u) : this.auth.me().pipe(catchError(() => of(null)))))
      )
      .subscribe((u: any) => {
        this.currentUser = u?.user ?? u ?? null;
        this.load();
      });
  }

  load() {
    this.loading = true;
    this.http.get<any>(`${this.baseUrl}/api/posts`).subscribe({
      next: (res) => {
        this.posts = res.posts ?? [];
        if (this.currentUser) {
          const me = this.currentUser._id ?? this.currentUser.id;
          this.posts.forEach(
            (p) => (p.likedByMe = (p.likes || []).some((x: any) => String(x) === String(me)))
          );
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erreur';
        this.loading = false;
      },
    });
  }

  mediaUrl(post: any) {
    return `${this.baseUrl}/api/posts/${post._id}/media`;
  }

  avatarUrl(user: any) {
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
      this.auth
        .me()
        .pipe(
          take(1),
          catchError(() => of(null))
        )
        .subscribe((res: any) => {
          const user = res?.user ?? res ?? null;
          if (!user) {
            this.router.navigate(['/login']);
            return;
          }
          this.currentUser = user;
          this.toggleLike(post);
        });
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
        if (err?.status === 401) this.router.navigate(['/login']);
      },
    });
  }

  addComment(post: any) {
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }
    const text = (this.newComment[post._id] || '').trim();
    if (!text) return;
    const postId = post._id;
    this.http
      .post<any>(`${this.baseUrl}/api/posts/${postId}/comment`, { text }, { withCredentials: true })
      .subscribe({
        next: (res) => {
          post.comments = post.comments || [];
          post.comments.push(res.comment);
          this.newComment[post._id] = '';
        },
        error: (err) => {
          console.error('Comment error', err);
        },
      });
  }

  openComments(post: any) {
    // refresh comments for the post if needed (simple approach: ensure we use the same object)
    this.selectedPostForComments = post;
  }

  closeComments() {
    this.selectedPostForComments = null;
  }

  submitModalComment() {
    if (!this.selectedPostForComments) return;
    this.addComment(this.selectedPostForComments);
  }

  sortedComments(post: any) {
    const cs = post.comments || [];
    return cs
      .slice()
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  onAvatarError(ev: Event) {
    const img = ev.target as HTMLImageElement;
    img.style.display = 'none';
  }
}
