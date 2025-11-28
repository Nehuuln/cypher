import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-register',
  standalone: true,
  templateUrl: './register.component.html',
  imports: [CommonModule, FormsModule, HttpClientModule],
})
export class RegisterComponent {
  username: string = '';
  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  consent: boolean = false;
  error: string | null = null;
  loading = false;
  successMessage: string | null = null;

  constructor(private http: HttpClient, private router: Router) {}

  private validateInputs(): boolean {
    this.error = null;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.error = 'Email invalide.';
      return false;
    }

    if (this.password !== this.confirmPassword) {
      this.error = 'Les mots de passe ne correspondent pas.';
      return false;
    }

    if (!this.password || this.password.length < 12) {
      this.error = 'Le mot de passe doit contenir au moins 12 caractères.';
      return false;
    }

    let classes = 0;
    if (/[A-Z]/.test(this.password)) classes++;
    if (/[a-z]/.test(this.password)) classes++;
    if (/\d/.test(this.password)) classes++;
    if (/[^A-Za-z0-9]/.test(this.password)) classes++;

    if (classes < 3) {
      this.error =
        'Le mot de passe doit contenir au moins 3 types de caractères : majuscules, minuscules, chiffres, caractères spéciaux.';
      return false;
    }

    return true;
  }

  register() {
    this.error = null;

    if (!this.username || !this.email || !this.password) {
      this.error = 'Veuillez remplir tous les champs.';
      return;
    }

    if (!this.consent) {
      this.error = "Vous devez accepter l'utilisation de vos données pour poursuivre.";
      return;
    }

    if (!this.validateInputs()) {
      return;
    }

    this.loading = true;
    const payload = {
      username: this.username,
      email: this.email,
      password: this.password,
      consent: this.consent,
    };
    this.http.post<any>('https://localhost:3000/api/register', payload).subscribe({
      next: (res) => {
        this.loading = false;
        this.successMessage = 'Inscription réussie ! Redirection vers la page de connexion...';
        this.error = null;
        this.username = '';
        this.email = '';
        this.password = '';
        this.confirmPassword = '';
        this.consent = false;
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      },
      error: (err) => {
        this.loading = false;
        if (err?.status === 409) {
          this.error = "Nom d'utilisateur ou e-mail déjà utilisé.";
        } else if (err?.status === 400 && err?.error?.message) {
          // show server validation message
          this.error = err.error.message;
        } else if (err?.error?.message) {
          this.error = err.error.message;
        } else {
          this.error = 'Erreur serveur, réessayez plus tard.';
        }
      },
    });
  }
}
