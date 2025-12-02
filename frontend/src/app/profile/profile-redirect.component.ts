import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-profile-redirect',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  template: `<div>Redirection vers votre profil…</div>`,
})
export class ProfileRedirectComponent implements OnInit {
  private baseUrl = 'https://localhost:3000';

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.http.get<any>(`${this.baseUrl}/api/me`, { withCredentials: true }).subscribe({
      next: (res) => {
        const tag = res.user?.tag;
        if (tag) {
          this.router.navigate(['/profil/user/tag', tag]);
        } else {
          this.router.navigate(['/profil/user/tag']);
        }
      },
      error: () => {
        this.router.navigate(['/profil/user/tag']);
      },
    });
  }
}
