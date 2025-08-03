// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private baseUrl = 'http://localhost:8080/api/auth';

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/login`, { email, password });
  }

  register(user: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/register`, user);
  }

  /**
   * Déconnecte l’utilisateur:
   * - (optionnel) appel backend /logout
   * - suppression du token local
   * Retourne un Observable pour .subscribe()
   */
  logout(): Observable<any> {
    // Si vous avez besoin d’appeler un endpoint logout :
    return this.http.post(`${this.baseUrl}/logout`, {}).pipe(
      tap(() => localStorage.removeItem('authToken')),
      catchError(err => {
        localStorage.removeItem('authToken');
        return of(null);
      })
    );

    // Sinon, pour un simple logout client-only, vous pouvez faire :
    // localStorage.removeItem('authToken');
    // return of(null);
  }
 

}
