import { Routes } from '@angular/router';
import { RegisterComponent } from './auth/register/register.component';
import { LoginComponent } from './auth/login/login.component';
import { AdminDashboardComponent } from './admin/admin-dashboard/admin-dashboard.component';
import { AdminGuard } from './auth/admin.guard';
import { ProfileComponent } from './profile/profile.component'
import { ProfileRedirectComponent } from './profile/profile-redirect.component';
import { LegalComponent } from './legal/legal.component';
import { MessagesComponent } from './messages/messages.component';
import { HomeComponent } from './cypher/home/home.component';
import { CreatePostComponent } from './cypher/posts/create-post.component'
import { AuthGuard } from './auth/auth.guard'
import { ProfilePublicComponent } from './profile/profile-public.component';

export const routes: Routes = [
  { path: '', component: HomeComponent},
  { path: 'register', component: RegisterComponent },
  { path: 'login', component: LoginComponent },
  { path: 'admin/dashboard', component: AdminDashboardComponent, canActivate: [AdminGuard] },
  { path: 'profil', component: ProfileRedirectComponent },
  { path: 'profil/user/:id', component: ProfileComponent },
  { path: 'profil/user/tag', component: ProfilePublicComponent },
  { path: 'profil/user/tag/:tag', component: ProfilePublicComponent },
  { path: 'legal', component: LegalComponent },
  { path: 'messages', component: MessagesComponent, canActivate: [AuthGuard] },
  { path: 'create', component: CreatePostComponent, canActivate: [AuthGuard] },
];