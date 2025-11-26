import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './admin-dashboard.component.html'
})
export class AdminDashboardComponent {
  users: any[] = [];
  loading = false;
  error: string | null = null;
  private baseUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {
    this.loadUsers();
  }

  loadUsers() {
    this.loading = true;
    this.http.get<any>(`${this.baseUrl}/api/admin/users`, { withCredentials: true }).subscribe({
      next: (res) => { this.users = res.users ?? []; this.loading = false; },
      error: (err) => { this.error = err?.error?.message || 'Erreur'; this.loading = false; }
    });
  }
}