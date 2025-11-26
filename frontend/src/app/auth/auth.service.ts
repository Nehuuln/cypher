import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private baseUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  login(email: string, password: string) {
    return this.http.post<any>(`${this.baseUrl}/api/login`, { email, password }, { withCredentials: true });
  }

  logout() {
    return this.http.post<any>(`${this.baseUrl}/api/logout`, {}, { withCredentials: true });
  }
}
