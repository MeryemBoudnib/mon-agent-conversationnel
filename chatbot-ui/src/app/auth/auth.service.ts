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

  // caches optionnels
  private _role: UserRole | null = null;
  private _email: string | null = null;

  constructor(private http: HttpClient) {
    const t = localStorage.getItem(this.storageKey);
    if (t) {
      this._role = extractRole(t);
      this._email = this.decodeEmailFromJwt(t);
      console.debug('[AuthService] boot role =', this._role, 'email =', this._email);
    }
  }

  /** Source de vérité = localStorage */
  get token(): string | null {
    return localStorage.getItem(this.storageKey);
  }

  /** Rôle dérivé du token */
  get role(): UserRole | null {
    const t = this.token;
    this._role = t ? extractRole(t) : null;
    return this._role;
  }

  /** 🔹 Email de l'utilisateur connecté (depuis JWT si possible) */
  getEmail(): string | null {
    if (this._email) return this._email;
    const t = this.token;
    this._email = t ? this.decodeEmailFromJwt(t) : null;
    return this._email;
  }

  /** 🔹 Namespace DocQA = email ou 'guest' */
  getNamespace(): string {
    return this.getEmail() || 'guest';
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
        this._email = this.decodeEmailFromJwt(token);
        console.debug('[AuthService.login] role =', this._role, 'email =', this._email);
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
          this._email = this.decodeEmailFromJwt(token);
        }
        return { token, role };
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.storageKey);
    this._role = null;
    this._email = null;
  }

  /** Décodage simple de l'email depuis le payload JWT (adapter les clés si besoin) */
  private decodeEmailFromJwt(token: string): string | null {
    try {
      const payload = JSON.parse(atob((token || '').split('.')[1] || ''));
      // adapte ces clés à ton backend
      return payload.email || payload.sub || payload.username || null;
    } catch {
      return null;
    }
  }
}
