import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { take } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit {
  user: any = null;
  loading = true;
  error: string | null = null;
  private baseUrl = 'https://localhost:3000';
  selectedFile: File | null = null;
  avatarUrl: string | null = null;

  form: any = { username: '', email: '', password: '', passwordConfirm: '', bio: '' };
  saving = false;

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

  saveProfile() {
    this.error = null;
    const pw = (this.form.password || '').toString();
    const pwConfirm = (this.form.passwordConfirm || '').toString();
    const oldPw = (this.form.oldPassword || '').toString();
    if (pw || pwConfirm) {
      if (!oldPw) {
        this.error = "Pour changer le mot de passe, renseignez l'ancien mot de passe.";
        return;
      }
      if (!pw || !pwConfirm) {
        this.error =
          'Pour changer le mot de passe, renseignez les deux champs (nouveau + confirmation).';
        return;
      }
      if (pw !== pwConfirm) {
        this.error = 'Les mots de passe ne correspondent pas.';
        return;
      }
      if (pw.length > 0 && pw.length < 12) {
        this.error = 'Le mot de passe doit contenir au moins 12 caractères.';
        return;
      }
    }

    this.saving = true;
    const fd = new FormData();
    let changed = false;

    if (
      this.form.username !== undefined &&
      this.form.username !== null &&
      String(this.form.username).trim() !== '' &&
      String(this.form.username) !== (this.user?.username || '')
    ) {
      fd.append('username', String(this.form.username).trim());
      changed = true;
    }
    if (
      this.form.email !== undefined &&
      this.form.email !== null &&
      String(this.form.email).trim() !== '' &&
      String(this.form.email).trim().toLowerCase() !== (this.user?.email || '').toLowerCase()
    ) {
      fd.append('email', String(this.form.email).trim());
      changed = true;
    }
    if (
      this.form.bio !== undefined &&
      this.form.bio !== null &&
      String(this.form.bio) !== (this.user?.bio || '')
    ) {
      fd.append('bio', String(this.form.bio));
      changed = true;
    }
    if (pw) {
      fd.append('password', pw);
      changed = true;
    }
    if (pw && oldPw) {
      fd.append('oldPassword', oldPw);
    }
    if (this.selectedFile) {
      fd.append('avatar', this.selectedFile);
      changed = true;
    }

    if (!changed) {
      this.saving = false;
      this.error = 'Aucune modification détectée.';
      return;
    }

    const id = this.user?._id;
    this.http.put<any>(`${this.baseUrl}/api/users/${id}`, fd, { withCredentials: true }).subscribe({
      next: (res) => {
        this.user = res.user;
        this.form.password = '';
        this.form.passwordConfirm = '';
        this.selectedFile = null;
        if (this.user?._id) this.loadAvatar(this.user._id);
        this.saving = false;
        try {
          this.router.navigate(['/profil']);
        } catch (e) {
          console.error('Navigation error after profile save', e);
        }
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erreur lors de la mise à jour';
        this.saving = false;
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
