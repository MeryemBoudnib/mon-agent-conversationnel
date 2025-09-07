import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, Subject } from 'rxjs';
import { extractRole, UserRole } from '../utils/jwt.util';

export interface RegisterPayload {
  firstName: string; lastName: string; email: string; password: string;
}

/** Réponse brute attendue depuis le backend Spring */
type AuthApiResponse = {
  token: string;
  role?: UserRole | null;
  active?: boolean | null;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private baseUrl = 'http://localhost:8080/api/auth';
  private storageKey = 'access_token';
  public readonly authChanged$ = new Subject<void>();

  private _role: UserRole | null = null;
  private _email: string | null = null;

  constructor(private http: HttpClient) {
    const t = localStorage.getItem(this.storageKey);
    if (t) { this._role = extractRole(t); this._email = this.decodeEmailFromJwt(t); }
  }

  get token(): string | null { return localStorage.getItem(this.storageKey); }
  get role(): UserRole | null { const t = this.token; this._role = t ? extractRole(t) : null; return this._role; }
  getEmail(): string | null { if (this._email) return this._email; const t = this.token; this._email = t ? this.decodeEmailFromJwt(t) : null; return this._email; }
  getNamespace(): string { return this.getEmail() || 'guest'; }
  isLoggedIn(): boolean { return !!this.token; }
  isAdmin(): boolean { return this.role === 'ADMIN'; }

  // -------- Auth de base --------
  /** Renvoie aussi active pour permettre l’alerte "compte désactivé" côté UI */
  login(email: string, password: string): Observable<{ token: string; role: UserRole | null; active: boolean | null }> {
    return this.http.post<AuthApiResponse>(`${this.baseUrl}/login`, { email, password }).pipe(
      map(resp => {
        const token = resp?.token; 
        if (!token) throw new Error('No token in /login response');

        // Stockage + mise à jour état local
        localStorage.setItem(this.storageKey, token);
        // Role prioritaire: celui renvoyé par l’API; sinon fallback au JWT
        this._role = (resp.role ?? extractRole(token)) as UserRole | null;
        this._email = this.decodeEmailFromJwt(token);
        this.authChanged$.next();

        return { token, role: this._role, active: resp.active ?? null };
      })
    );
  }

  /** Renvoie aussi active pour garder le même contrat que /login */
  register(payload: RegisterPayload): Observable<{ token?: string; role: UserRole | null; active: boolean | null }> {
    return this.http.post<AuthApiResponse>(`${this.baseUrl}/register`, payload).pipe(
      map(resp => {
        const token = resp?.token;
        let role: UserRole | null = null;
        let active: boolean | null = resp.active ?? null;

        if (token) {
          localStorage.setItem(this.storageKey, token);
          role = (resp.role ?? extractRole(token)) as UserRole | null;
          this._role = role; 
          this._email = this.decodeEmailFromJwt(token);
          this.authChanged$.next();
        }
        return { token, role, active };
      })
    );
  }

  // -------- Mot de passe (API standard par token) --------
  forgotPassword(email: string) {
    return this.http.post<{ message: string; resetUrl?: string }>(
      `${this.baseUrl}/forgot-password`, { email }
    );
  }
  verifyResetToken(token: string) {
    return this.http.post<{ valid: boolean }>(`${this.baseUrl}/verify-reset-token`, { token });
  }
  resetPassword(token: string, password: string, email?: string) {
    return this.http.post<void>(`${this.baseUrl}/reset-password`, { token, password, email });
  }

  // -------- DEV LOCAL : reset direct sans token --------
  resetPasswordDev(email: string, password: string) {
    return this.http.post<void>(`${this.baseUrl}/reset-password-dev`, { email, password });
  }

  logout(): void { 
    localStorage.removeItem(this.storageKey); 
    this._role = null; 
    this._email = null; 
    this.authChanged$.next(); 
  }

  private decodeEmailFromJwt(token: string): string | null {
    try { const payload = JSON.parse(atob((token || '').split('.')[1] || '')); return payload.email || payload.sub || payload.username || null; }
    catch { return null; }
  }
}
