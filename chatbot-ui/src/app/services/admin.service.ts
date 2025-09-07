import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, map, switchMap, catchError } from 'rxjs';

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

// ts peut être epoch(ms) OU string ISO, samples optionnel
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

/* ---------- Helpers ---------- */
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

@Injectable({ providedIn: 'root' })
export class AdminService {
  // Spring
  private baseAdmin           = 'http://localhost:8080/api/admin';
  private baseAnalyticsSpring = 'http://localhost:8080/api/analytics';

  // Flask
  private flaskRestBase = 'http://localhost:5000/analytics';
  private flaskMcp      = 'http://localhost:5000/mcp/execute';
  private flaskMetrics  = 'http://localhost:5000/metrics';

  // ⚠️ Si tu mets 'flask-mcp' ou 'flask-rest', on n’appellera PAS l’endpoint Spring de latence.
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

  /** yyyy-MM-ddTHH:mm:ss (sans Z) */
  private toIsoDateTime(input: string | Date): string {
    if (input instanceof Date) return input.toISOString().slice(0, 19);
    const d = new Date(input);
    return isNaN(d.getTime()) ? String(input).slice(0, 19) : d.toISOString().slice(0, 19);
  }

  /** yyyy-MM-ddTHH:mm:ssZ (UTC) — attendu par Spring @RequestParam Instant */
  private toIsoUtc(input: string | Date): string {
    const d = input instanceof Date ? input : new Date(input);
    return isNaN(d.getTime()) ? String(input) : d.toISOString().slice(0, 19) + 'Z';
  }

  /** Normalise n'importe quel format {tsMillis|ts} en epoch ms + nombres */
  private normalizeLatencyRows(rows: any[]): BotLatencyRow[] {
    const toEpoch = (t: any): number => {
      if (t == null) return NaN;
      if (typeof t === 'number') return t; // déjà epoch ms
      const s = String(t);
      const iso = s.includes('T') ? s : s.replace(' ', 'T'); // "YYYY-MM-DD HH:mm:ss" -> ISO-like
      const parsed = Date.parse(iso);
      return Number.isNaN(parsed) ? NaN : parsed;
    };

    return (rows ?? []).map(r => {
      const rawTs = r.tsMillis ?? r.ts ?? r.time ?? r.bucket ?? r.bucketStart ?? null;
      const ts = toEpoch(rawTs);
      return {
        ts: ts, // epoch ms pour la série datetime
        p50: Number(r.p50 ?? r.P50 ?? 0),
        p90: Number(r.p90 ?? r.P90 ?? 0),
        avg: Number(r.avg ?? r.mean ?? r.average ?? 0),
        samples: Number(r.samples ?? r.n ?? r.count ?? 0),
      } as BotLatencyRow;
    }).filter(r => !Number.isNaN(r.ts as number));
  }

  // ---------- Admin ----------
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
        active: coerceBool(
          r.active ?? r.isActive ?? r.enabled ?? r.status ?? r.is_enabled ?? r.is_active
        ),
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

  // ---------- Analytics ----------
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

  // ---------- Monitoring latence ----------
  // Si mode Flask ⇒ on ne touche pas Spring (évite 403). Spring seulement si ANALYTICS_MODE === 'spring'.
  latencyWindow(from: string | Date, to: string | Date): Observable<BotLatencyRow[]> {
    const useSpring = this.ANALYTICS_MODE === 'spring';

    // --------- FLASK (par défaut) ----------
    const isoZ = (d: string | Date) =>
      d instanceof Date ? d.toISOString().replace(/\.\d{3}Z$/, 'Z')
                        : (String(d).endsWith('Z') ? String(d) : String(d) + 'Z');
    const isoLocal = (d: string | Date) => {
      const s = d instanceof Date ? d.toISOString().slice(0,19) : String(d).slice(0,19);
      return s.replace('T', ' ');
    };
    const url = `${this.flaskMetrics}/latency-window`;
    const mkParams = (pairs: Record<string, string>) => {
      let p = new HttpParams();
      for (const k of Object.keys(pairs)) p = p.set(k, pairs[k]);
      return p.set('_', String(Date.now()));
    };
    const attempts: Array<{label: string; params: HttpParams}> = [
      { label: 'from/to UTC Z',        params: mkParams({ from: isoZ(from),     to: isoZ(to) }) },
      { label: 'from/to local noZ',    params: mkParams({ from: isoLocal(from), to: isoLocal(to) }) },
      { label: 'start/end UTC Z',      params: mkParams({ start: isoZ(from),    end: isoZ(to) }) },
      { label: 'window_minutes=1440',  params: mkParams({ window_minutes: '1440' }) },
    ];
    const tryFlaskOne = (i: number): Observable<BotLatencyRow[]> => {
      if (i >= attempts.length) return of<BotLatencyRow[]>([]);
      const { label, params } = attempts[i];
      return this.http.get<any[]>(url, { params }).pipe(
        map(rows => this.normalizeLatencyRows(rows ?? [])),
        switchMap(rows => rows.length > 0 ? of(rows) : tryFlaskOne(i + 1)),
        catchError(_ => tryFlaskOne(i + 1))
      );
    };

    if (!useSpring) {
      return tryFlaskOne(0);
    }

    // --------- SPRING (optionnel) ----------
    const fromUtc = this.toIsoUtc(from);
    const toUtc   = this.toIsoUtc(to);
    const springParams = new HttpParams()
      .set('from', fromUtc)
      .set('to', toUtc)
      .set('_', String(Date.now())); // anti-cache

    return this.http
      .get<any[]>(`${this.baseAdmin}/latency-window`, { params: springParams })
      .pipe(
        map(rows => this.normalizeLatencyRows(rows ?? [])),
        catchError(_ => of<BotLatencyRow[]>([])),
        switchMap(rows => rows.length > 0 ? of(rows) : tryFlaskOne(0))
      );
  }

  // ---------- IA ----------
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
