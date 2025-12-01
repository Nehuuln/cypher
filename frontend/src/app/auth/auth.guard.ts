import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';
import { AuthService } from './auth.service';

export const AuthGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.currentUser$.pipe(
    take(1),
    switchMap(user => {
      // if we already have a user, allow; otherwise call me() to refresh from server
      if (user) return of(user);
      return auth.me().pipe(catchError(() => of(null)));
    }),
    map((res: any) => {
      const user = res?.user ?? res;
      if (user) return true;
      // not authenticated -> redirect to home
      router.navigate(['/']);
      return false;
    })
  );
};