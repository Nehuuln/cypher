import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
 
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, HttpClientModule, RouterModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
})
export class AdminDashboardComponent {
  users: any[] = [];
  loading = false;
  error: string | null = null;
  private baseUrl = 'https://localhost:3000';

  // modal ban
  banModalOpen = false;
  banTarget: any = null;
  banMinutes: number | null = 60;
  banReason = '';
  banLoading = false;
  banError: string | null = null;

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

  isBanned(u: any): boolean {
    if (!u?.bannedUntil) return false;
    return new Date(u.bannedUntil).getTime() > Date.now();
  }

  openBanModal(u: any) {
    this.banTarget = u;
    this.banMinutes = this.isBanned(u) ? 0 : 60; 
    this.banReason = '';
    this.banError = null;
    this.banModalOpen = true;
  }

  closeBanModal() {
    this.banModalOpen = false;
    this.banTarget = null;
  }

  submitBan() {
    if (!this.banTarget) return;
    const minutes = Number(this.banMinutes ?? 0);
    if (Number.isNaN(minutes) || minutes < 0) {
      this.banError = 'Durée invalide';
      return;
    }
    this.banLoading = true;
    this.http
      .patch<any>(
        `${this.baseUrl}/api/admin/users/${this.banTarget._id}/ban`,
        { durationMinutes: minutes, reason: this.banReason },
        { withCredentials: true }
      )
      .subscribe({
        next: (res) => {
          this.banTarget.bannedUntil = res.user?.bannedUntil;
          this.banTarget = null;
          this.banModalOpen = false;
          this.banLoading = false;
        },
        error: (err) => {
          this.banError = err?.error?.message || 'Erreur';
          this.banLoading = false;
        },
      });
  }
}
