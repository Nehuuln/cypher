import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  imports: [CommonModule, FormsModule, HttpClientModule],
})
export class LoginComponent {
  email = '';
  password = '';
  error: string | null = null;
  loading = false;

  constructor(private http: HttpClient, private router: Router) {}

  login() {
    this.error = null;
    if (!this.email || !this.password) {
      this.error = 'Veuillez remplir tous les champs.';
      return;
    }
    this.loading = true;
    this.http.post<any>('http://localhost:3000/api/login', { email: this.email, password: this.password }, { withCredentials: true }).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.loading = false;
        if (err?.status === 401) {
          this.error = 'Identifiants invalides.';
        } else if (err?.error?.message) {
          this.error = err.error.message;
        } else {
          this.error = 'Erreur serveur, réessayez plus tard.';
        }
      }
    });
  }
}