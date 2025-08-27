// src/app/auth/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { extractRole, UserRole } from '../utils/jwt.util';

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private baseUrl = 'http://localhost:8080/api/auth';
  private storageKey = 'access_token';

  // cache optionnel (réhydraté au démarrage)
  private _role: UserRole | null = null;

  constructor(private http: HttpClient) {
    const t = localStorage.getItem(this.storageKey);
    if (t) {
      this._role = extractRole(t);
      console.debug('[AuthService] boot role =', this._role);
    }
  }

  /** Toujours lire la source de vérité: le storage */
  get token(): string | null {
    return localStorage.getItem(this.storageKey);
  }

  /** Renvoie le rôle calculé à partir du token (et met le cache à jour) */
  get role(): UserRole | null {
    const t = this.token;
    this._role = t ? extractRole(t) : null;
    return this._role;
  }

  isLoggedIn(): boolean {
    return !!this.token;
  }

  isAdmin(): boolean {
    return this.role === 'ADMIN';
  }

  login(email: string, password: string): Observable<{ token: string; role: UserRole | null }> {
    return this.http.post<{ token: string }>(`${this.baseUrl}/login`, { email, password }).pipe(
      map(resp => {
        const token = resp?.token;
        if (!token) throw new Error('No token in /login response');
        localStorage.setItem(this.storageKey, token);
        this._role = extractRole(token);
        console.debug('[AuthService.login] role =', this._role);
        return { token, role: this._role };
      })
    );
  }

  register(payload: RegisterPayload): Observable<{ token?: string; role: UserRole | null }> {
    return this.http.post<{ token?: string }>(`${this.baseUrl}/register`, payload).pipe(
      map(resp => {
        const token = resp?.token;
        let role: UserRole | null = null;
        if (token) {
          localStorage.setItem(this.storageKey, token); // auto-login (optionnel)
          role = extractRole(token);
          this._role = role;
        }
        return { token, role };
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.storageKey);
    this._role = null;
  }
}
