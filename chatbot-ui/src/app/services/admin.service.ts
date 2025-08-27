// src/app/services/admin.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface UserSignupDTO { date: string; count: number; }

export interface MsgPerDay { d: string; msgs: number; }
export interface StatDTO { key: string; value: number; }
export interface HeatCellDTO { dow: number; hour: number; count: number; }
export interface KeywordCountDTO { word: string; count: number; }
export interface AdminUser {
  id: number;
  firstName?: string;
  lastName?: string;
  email: string;
  role: 'USER' | 'ADMIN';
  conversations?: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private baseAdmin = 'http://localhost:8080/api/admin';
  private baseAnalytics = 'http://localhost:8080/api/analytics';

  constructor(private http: HttpClient) {}

  // --- Admin ---
  getStats(): Observable<any> {
    return this.http.get(`${this.baseAdmin}/stats`);
  }

  getUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${this.baseAdmin}/users`);
  }

  setRole(id: number, role: 'USER' | 'ADMIN'): Observable<void> {
    const params = new HttpParams().set('role', role);
    return this.http.post<void>(`${this.baseAdmin}/users/${id}/role`, null, { params });
  }

  // --- Signups per day (NEW) ---
  signupsPerDay(from: string, to: string): Observable<UserSignupDTO[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<UserSignupDTO[]>(`${this.baseAdmin}/signups-per-day`, { params });
  }

  // --- Analytics ---
  msgsPerDay(from: string, to: string): Observable<MsgPerDay[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http
      .get<Array<{ date: string; value: number }>>(`${this.baseAnalytics}/messages-per-day`, { params })
      .pipe(map(rows => (rows ?? []).map(r => ({ d: r.date, msgs: Number(r.value ?? 0) }))));
  }

  avgConv(from: string, to: string): Observable<StatDTO> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<StatDTO>(`${this.baseAnalytics}/avg-conv-duration`, { params });
  }

  heatmap(from: string, to: string): Observable<HeatCellDTO[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<HeatCellDTO[]>(`${this.baseAnalytics}/heatmap`, { params });
  }

  topKeywords(from: string, to: string, limit = 20): Observable<KeywordCountDTO[]> {
    const params = new HttpParams().set('from', from).set('to', to).set('limit', limit);
    return this.http.get<KeywordCountDTO[]>(`${this.baseAnalytics}/top-keywords`, { params });
  }
}
