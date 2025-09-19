import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, map, switchMap, catchError, tap } from 'rxjs';

/* ===================== DTOs / Types ===================== */

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
  active: boolean;
}

export interface BotLatencyRow {
  ts: number | string; p50: number; p90: number; avg: number; samples?: number;
}

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

export interface SummaryResponse {
  ok: boolean;
  used_llm?: boolean;
  summary_text: string;
  data: any;
}

type AnalyticsMode = 'spring' | 'flask-rest' | 'flask-mcp';

/* ===================== Helpers ===================== */

function coerceBool(v: any): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['true','1','yes','y','on','enabled','active'].includes(s))  return true;
    if (['false','0','no','n','off','disabled','inactive'].includes(s)) return false;
  }
  return false;
}

/* ===================== Service ===================== */

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

  /* ------------ format helpers ------------ */

  private toIsoDate(input: string | Date): string {
    if (input instanceof Date) return input.toISOString().slice(0, 10);
    const s = (input || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
  }

  private toIsoUtc(input: string | Date): string {
    const d = input instanceof Date ? input : new Date(input);
    return isNaN(d.getTime()) ? String(input) : d.toISOString().slice(0, 19) + 'Z';
  }

  private unwrapRows(resp: any): any[] {
    if (Array.isArray(resp)) return resp;
    if (Array.isArray(resp?.rows)) return resp.rows;
    if (Array.isArray(resp?.data)) return resp.data;
    if (Array.isArray(resp?.data?.rows)) return resp.data.rows;
    if (Array.isArray(resp?.result)) return resp.result;
    console.warn('[metrics] unexpected payload shape:', resp);
    return [];
  }

  private normalizeLatencyRows(rows: any[]): BotLatencyRow[] {
    const toEpoch = (t: any): number => {
      if (t == null) return NaN;
      if (typeof t === 'number') return t < 1e12 ? Math.round(t * 1000) : t; // sec→ms
      const s = String(t);
      const iso = s.includes('T') ? s : s.replace(' ', 'T');
      const parsed = Date.parse(iso);
      return Number.isNaN(parsed) ? NaN : parsed;
    };
    const num = (v: any) => (v == null ? NaN : Number(v));

    return (rows ?? []).map(r => {
      const rawTs =
        r.tsMillis ?? r.ts_ms ?? r.tsMs ?? r.ts_epoch ?? r.tsEpoch ??
        r.ts ?? r.time ?? r.timestamp ?? r.datetime ?? r.date ??
        r.bucketStart ?? r.bucket ?? r.t ?? null;

      const p50s = !Number.isNaN(num(r.p50_ms)) ? num(r.p50_ms)/1000
                : !Number.isNaN(num(r.P50_ms))   ? num(r.P50_ms)/1000
                : !Number.isNaN(num(r.p50))      ? num(r.p50)
                : !Number.isNaN(num(r.P50))      ? num(r.P50)
                : !Number.isNaN(num(r.median))   ? num(r.median) : NaN;

      const p90s = !Number.isNaN(num(r.p90_ms)) ? num(r.p90_ms)/1000
                : !Number.isNaN(num(r.P90_ms))   ? num(r.P90_ms)/1000
                : !Number.isNaN(num(r.p90))      ? num(r.p90)
                : !Number.isNaN(num(r.P90))      ? num(r.P90)
                : !Number.isNaN(num(r.p95_ms))   ? num(r.p95_ms)/1000
                : !Number.isNaN(num(r.P95_ms))   ? num(r.P95_ms)/1000
                : !Number.isNaN(num(r.p95))      ? num(r.p95)
                : !Number.isNaN(num(r.P95))      ? num(r.P95) : NaN;

      const avgs = !Number.isNaN(num(r.avg_ms))     ? num(r.avg_ms)/1000
                 : !Number.isNaN(num(r.mean_ms))    ? num(r.mean_ms)/1000
                 : !Number.isNaN(num(r.average_ms)) ? num(r.average_ms)/1000
                 : !Number.isNaN(num(r.avg))        ? num(r.avg)
                 : !Number.isNaN(num(r.mean))       ? num(r.mean)
                 : !Number.isNaN(num(r.average))    ? num(r.average) : NaN;

      const ts = toEpoch(rawTs);
      return {
        ts,
        p50: Number.isNaN(p50s) ? 0 : p50s,
        p90: Number.isNaN(p90s) ? 0 : p90s,
        avg: Number.isNaN(avgs) ? 0 : avgs,
        samples: Number(r.samples ?? r.n ?? r.count ?? 0)
      } as BotLatencyRow;
    }).filter(r => !Number.isNaN(r.ts as number));
  }

  /* --------------------- Admin --------------------- */

  getStats(): Observable<any> { return this.http.get(`${this.baseAdmin}/stats`); }

  getUsers(): Observable<AdminUser[]> {
    return this.http.get<any[]>(`${this.baseAdmin}/users`).pipe(
      map(rows => (rows ?? []).map(r => ({
        id: Number(r.id),
        firstName: r.firstName ?? r.firstname ?? r.first_name ?? '',
        lastName:  r.lastName  ?? r.lastname  ?? r.last_name  ?? '',
        email: String(r.email ?? ''),
        role: (r.role ?? 'USER') as 'USER' | 'ADMIN',
        conversations: Number(r.conversations ?? 0),
        active: coerceBool(r.active ?? r.isActive ?? r.enabled ?? r.status ?? r.is_enabled ?? r.is_active),
      })))
    );
  }

  setUserActive(id: number, active: boolean): Observable<void> {
    return this.http.put<void>(`${this.baseAdmin}/users/${id}/active`, { active });
  }
  setUserActiveQP(id: number, active: boolean): Observable<void> {
    const params = new HttpParams().set('active', String(active));
    return this.http.post<void>(`${this.baseAdmin}/users/${id}/active`, null, { params });
  }
  deleteUser(id: number): Observable<void> { return this.http.delete<void>(`${this.baseAdmin}/users/${id}`); }
  setRole(id: number, role: 'USER' | 'ADMIN'): Observable<void> {
    const params = new HttpParams().set('role', role);
    return this.http.post<void>(`${this.baseAdmin}/users/${id}/role`, null, { params });
  }

  /* ------------------- Analytics ------------------- */

  msgsPerDay(from: string, to: string): Observable<MsgPerDay[]> {
    const f = this.toIsoDate(from), t = this.toIsoDate(to);

    if (this.ANALYTICS_MODE === 'flask-rest') {
      const params = new HttpParams().set('from', f).set('to', t);
      return this.http
        .get<Array<{ date: string; value: number }>>(`${this.flaskRestBase}/messages-per-day`, { params })
        .pipe(map(rows => (rows ?? []).map(r => ({ d: r.date, msgs: Number(r.value ?? 0) })))); }

    if (this.ANALYTICS_MODE === 'flask-mcp') {
      const body = { action: 'analytics_messages_per_day', parameters: { from: `${f}T00:00:00`, to: `${t}T23:59:59` } };
      return this.http.post<any>(this.flaskMcp, body)
        .pipe(map(resp => (resp?.data ?? []).map((r: any) => ({ d: r.date, msgs: Number(r.value ?? 0) })))); }

    const params = new HttpParams().set('from', f).set('to', t);
    return this.http
      .get<Array<{ date: string; value: number }>>(`${this.baseAnalyticsSpring}/messages-per-day`, { params })
      .pipe(map(rows => (rows ?? []).map(r => ({ d: r.date, msgs: Number(r.value ?? 0) })))); }

  avgConv(from: string, to: string): Observable<StatDTO> {
    const f = this.toIsoDate(from), t = this.toIsoDate(to);

    if (this.ANALYTICS_MODE === 'flask-rest') {
      const params = new HttpParams().set('from', f).set('to', t);
      return this.http.get<any>(`${this.flaskRestBase}/avg-conv-duration`, { params })
        .pipe(map(res => ({ key: 'avgMinutes', value: Number(res?.value ?? 0) }))); }

    if (this.ANALYTICS_MODE === 'flask-mcp') {
      const body = { action: 'analytics_avg_conv_duration', parameters: { from: `${f}T00:00:00`, to: `${t}T23:59:59` } };
      return this.http.post<any>(this.flaskMcp, body)
        .pipe(map(resp => ({ key: 'avgMinutes', value: Number(resp?.data?.value ?? 0) }))); }

    const params = new HttpParams().set('from', f).set('to', t);
    return this.http.get<StatDTO>(`${this.baseAnalyticsSpring}/avg-conv-duration`, { params }); }

  heatmap(from: string, to: string): Observable<HeatCellDTO[]> {
    const f = this.toIsoDate(from), t = this.toIsoDate(to);

    if (this.ANALYTICS_MODE === 'flask-rest') {
      const params = new HttpParams().set('from', f).set('to', t);
      return this.http.get<HeatCellDTO[]>(`${this.flaskRestBase}/heatmap`, { params }); }

    if (this.ANALYTICS_MODE === 'flask-mcp') {
      const body = { action: 'analytics_heatmap', parameters: { from: `${f}T00:00:00`, to: `${t}T23:59:59` } };
      return this.http.post<any>(this.flaskMcp, body).pipe(map(resp => resp?.data ?? [])); }

    const params = new HttpParams().set('from', f).set('to', t);
    return this.http.get<HeatCellDTO[]>(`${this.baseAnalyticsSpring}/heatmap`, { params }); }

  signupsPerDay(from: string, to: string): Observable<UserSignupDTO[]> {
    const f = this.toIsoDate(from), t = this.toIsoDate(to);

    if (this.ANALYTICS_MODE === 'flask-rest') {
      const params = new HttpParams().set('from', f).set('to', t);
      return this.http.get<UserSignupDTO[]>(`${this.flaskRestBase}/signups-per-day`, { params }); }

    if (this.ANALYTICS_MODE === 'flask-mcp') {
      const body = { action: 'analytics_signups_per_day', parameters: { from: `${f}T00:00:00`, to: `${t}T23:59:59` } };
      return this.http.post<any>(this.flaskMcp, body).pipe(map(resp => resp?.data ?? [])); }

    const params = new HttpParams().set('from', f).set('to', t);
    return this.http.get<UserSignupDTO[]>(`${this.baseAdmin}/signups-per-day`, { params }); }

  /* --------------- Monitoring latence --------------- */

  latencyWindow(from: string | Date, to: string | Date): Observable<BotLatencyRow[]> {
    const useSpring = this.ANALYTICS_MODE === 'spring';

    const asDate = (d: string | Date) => (d instanceof Date ? d : new Date(d));
    const fromD = asDate(from);
    const toD   = asDate(to);

    const fromIsoZ = fromD.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const toIsoZ   = toD.toISOString().replace(/\.\d{3}Z$/, 'Z');

    const toLocalNoZ = (d: Date) => d.toISOString().slice(0,19).replace('T', ' ');
    const fromLocal  = toLocalNoZ(fromD);
    const toLocal    = toLocalNoZ(toD);

    const fromMs = fromD.getTime();
    const toMs   = toD.getTime();
    const fromSec = Math.floor(fromMs / 1000);
    const toSec   = Math.floor(toMs   / 1000);

    const url = `${this.flaskMetrics}/latency-window`;
    const mkParams = (pairs: Record<string, string | number>) => {
      let p = new HttpParams();
      for (const k of Object.keys(pairs)) {
        const v = pairs[k];
        if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
      }
      return p.set('_', String(Date.now()));
    };

    const attempts: Array<{label: string; params: HttpParams}> = [
      { label: 'from/to ISO Z + bucket_min',   params: mkParams({ from: fromIsoZ, to: toIsoZ, bucket_min: 5 }) },
      { label: 'start/end ISO Z + bucket_min', params: mkParams({ start: fromIsoZ, end: toIsoZ, bucket_min: 5 }) },
      { label: 'from/to local + bucket_min',   params: mkParams({ from: fromLocal, to: toLocal, bucket_min: 5 }) },
      { label: 'since/until + bucket_min',     params: mkParams({ since: fromIsoZ, until: toIsoZ, bucket_min: 5 }) },
      { label: 'from/to + bucketMin',          params: mkParams({ from: fromIsoZ, to: toIsoZ, bucketMin: 5 }) },
      { label: 'lookback_minutes=1440',        params: mkParams({ lookback_minutes: 1440 }) },
      { label: 'window_minutes=1440',          params: mkParams({ window_minutes: 1440 }) },
      { label: 'from_ms/to_ms',                params: mkParams({ from_ms: fromMs, to_ms: toMs, bucket_min: 5 }) },
      { label: 'from_epoch_ms/to_epoch_ms',    params: mkParams({ from_epoch_ms: fromMs, to_epoch_ms: toMs, bucket_min: 5 }) },
      { label: 'from_epoch/to_epoch (sec)',    params: mkParams({ from_epoch: fromSec, to_epoch: toSec, bucket_min: 5 }) },
    ];

    const tryFlaskOne = (i: number): Observable<BotLatencyRow[]> => {
      if (i >= attempts.length) return of<BotLatencyRow[]>([]);
      const { label, params } = attempts[i];
      return this.http.get<any>(url, { params }).pipe(
        tap(resp => console.debug('[metrics] raw', label, resp)),
        map(resp => this.normalizeLatencyRows(this.unwrapRows(resp))),
        switchMap(rows => rows.length > 0 ? of(rows) : tryFlaskOne(i + 1)),
        catchError(_ => tryFlaskOne(i + 1))
      );
    };

    if (!useSpring) return tryFlaskOne(0);

    const springParams = new HttpParams()
      .set('from', this.toIsoUtc(from))
      .set('to',   this.toIsoUtc(to))
      .set('_',    String(Date.now()));

    return this.http
      .get<any>(`${this.baseAdmin}/latency-window`, { params: springParams })
      .pipe(
        map(resp => this.normalizeLatencyRows(this.unwrapRows(resp))),
        catchError(_ => of<BotLatencyRow[]>([])),
        switchMap(rows => rows.length > 0 ? of(rows) : tryFlaskOne(0))
      );
  }

  /* --------------------- IA --------------------- */

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
