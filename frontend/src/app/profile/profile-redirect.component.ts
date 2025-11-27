import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-profile-redirect',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  template: `<div>Redirection vers votre profil…</div>`
})
export class ProfileRedirectComponent implements OnInit {
  private baseUrl = 'http://localhost:3000';

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.http.get<any>(`${this.baseUrl}/api/me`, { withCredentials: true }).subscribe({
      next: (res) => {
        const myId = res.user?._id || res.user?.id;
        if (myId) {
          this.router.navigate(['/profil/user', myId]);
        } else {
          this.router.navigate(['/login']);
        }
      },
      error: () => this.router.navigate(['/login'])
    });
  }
}
