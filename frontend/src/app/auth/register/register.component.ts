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
    error: string | null = null;
    loading = false;

    constructor(private http: HttpClient, private router: Router) {}

    register() {
        this.error = null;
        if (!this.username || !this.email || !this.password) {
            this.error = 'Veuillez remplir tous les champs.';
            return;
        }
        if (this.password !== this.confirmPassword) {
            this.error = 'Les mots de passe ne correspondent pas.';
            return;
        }

        this.loading = true;
        const payload = { username: this.username, email: this.email, password: this.password };
        this.http.post<any>('http://localhost:3000/api/register', payload).subscribe({
            next: (res) => {
                this.loading = false;
                this.router.navigate(['/login']);
            },
            error: (err) => {
                this.loading = false;
                if (err?.status === 409) {
                    this.error = 'Nom d\'utilisateur ou e-mail déjà utilisé.';
                } else if (err?.error?.message) {
                    this.error = err.error.message;
                } else {
                    this.error = 'Erreur serveur, réessayez plus tard.';
                }
            }
        });
    }
}