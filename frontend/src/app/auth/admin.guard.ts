import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthService } from './auth.service';

export const AdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.currentUser$.pipe(
    take(1),
    switchMap(user => user ? of(user) : auth.me()),
    map((res: any) => {
      const user = res?.user ?? res; // me() returns { user } while currentUser$ emits user
      const roles = Array.isArray(user?.roles) ? user.roles : [];
      const isAdmin = roles.some((r: string) => String(r).toLowerCase() === 'admin');
      if (isAdmin) return true;
      router.navigate(['/']);
      return false;
    })
  );
};
