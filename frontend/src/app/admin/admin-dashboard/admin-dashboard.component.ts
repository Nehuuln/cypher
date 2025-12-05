import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
 
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, HttpClientModule, RouterModule],
  templateUrl: './admin-dashboard.component.html',
})
export class AdminDashboardComponent {
  users: any[] = [];
  loading = false;
  error: string | null = null;
  private baseUrl = 'https://localhost:3000';

  constructor(private http: HttpClient) {
    this.loadUsers();
  }

  loadUsers() {
    this.loading = true;
    this.http.get<any>(`${this.baseUrl}/api/admin/users`, { withCredentials: true }).subscribe({
      next: (res) => {
        this.users = res.users ?? [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erreur';
        this.loading = false;
      },
    });
  }

  toggleRole(u: any) {
    const nextRole = (u.roles || []).includes('admin') ? 'user' : 'admin';
    this.changeRole(u, nextRole);
  }

  changeRole(u: any, role: string) {
    if (!role) return;
    this.http
      .patch<any>(`${this.baseUrl}/api/admin/users/${u._id}/role`, { role }, { withCredentials: true })
      .subscribe({
        next: (res) => {
          u.roles = res.user?.roles || u.roles;
        },
        error: (err) => {
          this.error = err?.error?.message || 'Erreur';
        },
      });
  }
}
