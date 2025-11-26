import { Component, signal } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('frontend');
  username: string | null = null;
  isAdmin = false;

  constructor(private auth: AuthService, private router: Router) {
    this.auth.currentUser$.subscribe((user) => {
      this.username = user?.username ?? null;
      const roles = Array.isArray(user?.roles) ? user.roles : [];
      this.isAdmin = roles.some((role: string) => String(role).toLowerCase() === 'admin');
    });
    this.auth.me().subscribe({ error: () => {} });
  }

  logout() {
    this.auth.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: () => {
        this.router.navigate(['/login']);
      }
    });
  }
}