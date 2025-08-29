import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface UserSignupDTO { date: string; count: number; }
export interface MsgPerDay { d: string; msgs: number; }
export interface StatDTO { key: string; value: number; }
export interface HeatCellDTO { dow: number; hour: number; count: number; }
export interface AdminUser {
  id: number;
  firstName?: string;
  lastName?: string;
  email: string;
  role: 'USER' | 'ADMIN';
  conversations?: number;
}
export interface BotLatencyRow {
  ts: string; p50: number; p90: number; avg: number; samples: number;
}

/** Prévision risque (Flask /metrics/forecast-risk) */
export interface ForecastPoint {
  ts: string;
  p90_pred: number;
  low: number;
  high: number;
  prob_exceed_slo: number | null;
  prob_exceed_baseline?: number | null;
  risk_level: 'low' | 'medium' | 'high';
  baseline_p95?: number | null;
}
export interface ForecastResponse {
  ok: boolean;
  alert: boolean;
  slo_p90: number;
  bucket_min: number;
  alpha: number;
  overall_max_prob: number;
  points: ForecastPoint[];
}

/** Résumé IA (Flask /metrics/summary) */
export interface SummaryResponse {
  ok: boolean;
  used_llm?: boolean;
  summary_text: string;
  data: any;
}

type AnalyticsMode = 'spring' | 'flask-rest' | 'flask-mcp';

@Injectable({ providedIn: 'root' })
export class AdminService {
  // Spring
  private baseAdmin           = 'http://localhost:8080/api/admin';
  private baseAnalyticsSpring = 'http://localhost:8080/api/analytics';

  // Flask
  private flaskRestBase = 'http://localhost:5000/analytics';
  private flaskMcp      = 'http://localhost:5000/mcp/execute';
  private flaskMetrics  = 'http://localhost:5000/metrics';

  private ANALYTICS_MODE: AnalyticsMode = 'flask-mcp';

  constructor(private http: HttpClient) {}

  private toIsoDate(input: string | Date): string {
    if (input instanceof Date) return input.toISOString().slice(0, 10);
    const s = (input || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
  }

  // ---- Admin (Spring)
  getStats(): Observable<any> { return this.http.get(`${this.baseAdmin}/stats`); }
  getUsers(): Observable<AdminUser[]> { return this.http.get<AdminUser[]>(`${this.baseAdmin}/users`); }
  setRole(id: number, role: 'USER' | 'ADMIN'): Observable<void> {
    const params = new HttpParams().set('role', role);
    return this.http.post<void>(`${this.baseAdmin}/users/${id}/role`, null, { params });
  }

  // ---- Analytics
  msgsPerDay(from: string, to: string): Observable<MsgPerDay[]> {
    const f = this.toIsoDate(from), t = this.toIsoDate(to);

    if (this.ANALYTICS_MODE === 'flask-rest') {
      const params = new HttpParams().set('from', f).set('to', t);
      return this.http
        .get<Array<{ date: string; value: number }>>(`${this.flaskRestBase}/messages-per-day`, { params })
        .pipe(map(rows => (rows ?? []).map(r => ({ d: r.date, msgs: Number(r.value ?? 0) }))));
    }

    if (this.ANALYTICS_MODE === 'flask-mcp') {
      const body = { action: 'analytics_messages_per_day', parameters: { from: `${f}T00:00:00`, to: `${t}T23:59:59` } };
      return this.http.post<any>(this.flaskMcp, body)
        .pipe(map(resp => (resp?.data ?? []).map((r: any) => ({ d: r.date, msgs: Number(r.value ?? 0) }))));
    }

    const params = new HttpParams().set('from', f).set('to', t);
    return this.http
      .get<Array<{ date: string; value: number }>>(`${this.baseAnalyticsSpring}/messages-per-day`, { params })
      .pipe(map(rows => (rows ?? []).map(r => ({ d: r.date, msgs: Number(r.value ?? 0) }))));
  }

  avgConv(from: string, to: string): Observable<StatDTO> {
    const f = this.toIsoDate(from), t = this.toIsoDate(to);

    if (this.ANALYTICS_MODE === 'flask-rest') {
      const params = new HttpParams().set('from', f).set('to', t);
      return this.http.get<any>(`${this.flaskRestBase}/avg-conv-duration`, { params })
        .pipe(map(res => ({ key: 'avgMinutes', value: Number(res?.value ?? 0) })));
    }

    if (this.ANALYTICS_MODE === 'flask-mcp') {
      const body = { action: 'analytics_avg_conv_duration', parameters: { from: `${f}T00:00:00`, to: `${t}T23:59:59` } };
      return this.http.post<any>(this.flaskMcp, body)
        .pipe(map(resp => ({ key: 'avgMinutes', value: Number(resp?.data?.value ?? 0) })));
    }

    const params = new HttpParams().set('from', f).set('to', t);
    return this.http.get<StatDTO>(`${this.baseAnalyticsSpring}/avg-conv-duration`, { params });
  }

  heatmap(from: string, to: string): Observable<HeatCellDTO[]> {
    const f = this.toIsoDate(from), t = this.toIsoDate(to);

    if (this.ANALYTICS_MODE === 'flask-rest') {
      const params = new HttpParams().set('from', f).set('to', t);
      return this.http.get<HeatCellDTO[]>(`${this.flaskRestBase}/heatmap`, { params });
    }

    if (this.ANALYTICS_MODE === 'flask-mcp') {
      const body = { action: 'analytics_heatmap', parameters: { from: `${f}T00:00:00`, to: `${t}T23:59:59` } };
      return this.http.post<any>(this.flaskMcp, body).pipe(map(resp => resp?.data ?? []));
    }

    const params = new HttpParams().set('from', f).set('to', t);
    return this.http.get<HeatCellDTO[]>(`${this.baseAnalyticsSpring}/heatmap`, { params });
  }

  signupsPerDay(from: string, to: string): Observable<UserSignupDTO[]> {
    const f = this.toIsoDate(from), t = this.toIsoDate(to);

    if (this.ANALYTICS_MODE === 'flask-rest') {
      const params = new HttpParams().set('from', f).set('to', t);
      return this.http.get<UserSignupDTO[]>(`${this.flaskRestBase}/signups-per-day`, { params });
    }

    if (this.ANALYTICS_MODE === 'flask-mcp') {
      const body = { action: 'analytics_signups_per_day', parameters: { from: `${f}T00:00:00`, to: `${t}T23:59:59` } };
      return this.http.post<any>(this.flaskMcp, body).pipe(map(resp => resp?.data ?? []));
    }

    const params = new HttpParams().set('from', f).set('to', t);
    return this.http.get<UserSignupDTO[]>(`${this.baseAdmin}/signups-per-day`, { params });
  }

  // ---- Monitoring latence (Flask direct)
  latencyWindow(from: string, to: string): Observable<BotLatencyRow[]> {
    const f = this.toIsoDate(from), t = this.toIsoDate(to);
    const params = new HttpParams().set('from', `${f}T00:00:00`).set('to', `${t}T23:59:59`);
    return this.http.get<BotLatencyRow[]>(`${this.flaskMetrics}/latency-window`, { params });
  }

  // ---- IA (Résumé & Prévision)
  metricsSummary(fromIso: string, toIso: string, slo_p90 = 0.8): Observable<SummaryResponse> {
    const params = new HttpParams()
      .set('from', `${fromIso}T00:00:00`)
      .set('to', `${toIso}T23:59:59`)
      .set('slo_p90', String(slo_p90));
    return this.http.get<SummaryResponse>(`${this.flaskMetrics}/summary`, { params });
  }

  metricsForecastRisk(opts: { slo_p90: number; horizon_min?: number; bucket_min?: number; alpha?: number; }): Observable<ForecastResponse> {
    const params = new HttpParams()
      .set('slo_p90', String(opts.slo_p90))
      .set('horizon_min', String(opts.horizon_min ?? 60))
      .set('bucket_min', String(opts.bucket_min ?? 5))
      .set('alpha', String(opts.alpha ?? 0.35));
    return this.http.get<ForecastResponse>(`${this.flaskMetrics}/forecast-risk`, { params });
  }
}
