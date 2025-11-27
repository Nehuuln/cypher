import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private baseUrl = 'http://localhost:3000';
  private _currentUser = new BehaviorSubject<any | null>(null);
  public currentUser$: Observable<any | null> = this._currentUser.asObservable();

  constructor(private http: HttpClient) {
    // Charger l'utilisateur au démarrage
    this.loadCurrentUser();
  }

  login(email: string, password: string) {
    return this.http
      .post<any>(`${this.baseUrl}/api/login`, { email, password }, { withCredentials: true })
      .pipe(
        tap(() => {
          // after successful login, refresh current user
          this.me().subscribe({
            next: (res) => this._currentUser.next(res?.user ?? null),
            error: () => this._currentUser.next(null),
          });
        })
      );
  }

  logout() {
    return this.http
      .post<any>(`${this.baseUrl}/api/logout`, {}, { withCredentials: true })
      .pipe(tap(() => this._currentUser.next(null)));
  }

  me() {
    return this.http
      .get<any>(`${this.baseUrl}/api/me`, { withCredentials: true })
      .pipe(tap((res) => this._currentUser.next(res?.user ?? null)));
  }

  // ===== NOUVELLES MÉTHODES =====

  loadCurrentUser(): void {
    this.me().subscribe({
      next: (res) => this._currentUser.next(res?.user ?? null),
      error: () => this._currentUser.next(null),
    });
  }

  getCurrentUser(): any | null {
    return this._currentUser.value;
  }

  isAuthenticated(): boolean {
    return this._currentUser.value !== null;
  }

  hasRole(role: string): boolean {
    const user = this._currentUser.value;
    return user && user.roles ? user.roles.includes(role) : false;
  }

  isAdmin(): boolean {
    return this.hasRole('admin');
  }
}
