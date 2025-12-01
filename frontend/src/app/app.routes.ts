import { Routes } from '@angular/router';
import { RegisterComponent } from './auth/register/register.component';
import { LoginComponent } from './auth/login/login.component';
import { AdminDashboardComponent } from './admin/admin-dashboard/admin-dashboard.component';
import { AdminGuard } from './auth/admin.guard';
import { ProfileComponent } from './profile/profile.component'
import { ProfileRedirectComponent } from './profile/profile-redirect.component';
import { LegalComponent } from './legal/legal.component';
import { MessagesComponent } from './messages/messages.component';

export const routes: Routes = [
  { path: 'register', component: RegisterComponent },
  { path: 'login', component: LoginComponent },
  { path: 'admin/dashboard', component: AdminDashboardComponent, canActivate: [AdminGuard] },
  { path: 'profil', component: ProfileRedirectComponent },
  { path: 'profil/user/:id', component: ProfileComponent },
  { path: 'legal', component: LegalComponent },
  { path: 'messages', component: MessagesComponent },
];