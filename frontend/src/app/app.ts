import { Component, signal } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
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
  isLoginRoute = false;
  isRegisterRoute = false;

  constructor(private auth: AuthService, private router: Router) {
    this.auth.currentUser$.subscribe((user) => {
      this.username = user?.username ?? null;
      const roles = Array.isArray(user?.roles) ? user.roles : [];
      this.isAdmin = roles.some((role: string) => String(role).toLowerCase() === 'admin');
    });
    this.auth.me().subscribe({ error: () => {} });
    this.isLoginRoute = this.router.url === '/login';
    this.router.events.subscribe((ev) => {
      if (ev instanceof NavigationEnd) {
        this.isLoginRoute = ev.urlAfterRedirects === '/login';
      }
    });
    this.isRegisterRoute = this.router.url === '/register';
    this.router.events.subscribe((ev) => {
      if (ev instanceof NavigationEnd) {
        this.isRegisterRoute = ev.urlAfterRedirects === '/register';
      }
    });
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