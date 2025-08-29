import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

type SummaryResp = {
  ok: boolean;
  data: {
    period: { from: string; to: string };
    p90: { min: number; min_ts: string; median: number; avg: number; max: number; max_ts: string };
    trend: { direction: 'hausse' | 'baisse' | 'stable'; slope_sec_per_hour: number };
    anomalies_vs_baseline_p95: number;
    corr_p90_traffic: number | null;
    points: number;
    slo_p90: number;
  };
  summary_text: string;
  used_llm: boolean;
};

type ForecastPoint = {
  ts: string;
  p90_pred: number;
  low: number;   // IC bas
  high: number;  // IC haut
  prob_exceed_slo: number;       // 0..1
  prob_exceed_baseline: number | null; // 0..1
  risk_level: 'low' | 'medium' | 'high';
  baseline_p95: number | null;
};

type ForecastResp = {
  ok: boolean;
  slo_p90: number;
  bucket_min: number;
  alpha: number;
  alert: boolean;
  overall_max_prob: number; // max prob_exceed_slo
  points: ForecastPoint[];
};

@Component({
  selector: 'app-ai-summary-forecast',
  templateUrl: './ai-summary-forecast.component.html',
  styleUrls: ['./ai-summary-forecast.component.css']
})
export class AiSummaryForecastComponent implements OnChanges {

  /** Période à résumer */
  @Input() from?: Date | string;
  @Input() to?: Date | string;

  /** SLO P90 cible (secondes) */
  @Input() sloP90 = 0.8;

  /** Backend (Flask) */
  @Input() apiBase = 'http://localhost:5000';

  // state
  loading = false;
  error?: string;

  summary?: SummaryResp;
  forecast?: ForecastResp;

  // petite vue tabulaire pour la prévision (prochaine heure)
  rows: Array<{
    ts: string;
    p90: number;
    probSloPct: number;
    risk: 'low' | 'medium' | 'high';
  }> = [];

  constructor(private http: HttpClient) {}

  ngOnChanges(ch: SimpleChanges): void {
    // (re)charge dès qu’on change la période ou le SLO
    this.load();
  }

  private iso(v?: Date | string): string | undefined {
    if (!v) return undefined;
    if (typeof v === 'string') return v;
    return v.toISOString();
  }

  load(): void {
    this.error = undefined;
    this.loading = true;

    const fromIso = this.iso(this.from);
    const toIso   = this.iso(this.to);

    // 1) résumé
    let p = new HttpParams();
    if (fromIso) p = p.set('from', fromIso);
    if (toIso)   p = p.set('to', toIso);
    p = p.set('slo_p90', String(this.sloP90));

    this.http.get<SummaryResp>(`${this.apiBase}/metrics/summary`, { params: p })
      .subscribe({
        next: (s) => {
          this.summary = s;
          // 2) forecast ensuite
          let pf = new HttpParams()
            .set('horizon_min', '60')
            .set('bucket_min', '5')
            .set('alpha', '0.35')
            .set('slo_p90', String(this.sloP90));
          this.http.get<ForecastResp>(`${this.apiBase}/metrics/forecast-risk`, { params: pf })
            .subscribe({
              next: (f) => {
                this.forecast = f;
                this.rows = (f.points || []).map(pt => ({
                  ts: pt.ts,
                  p90: pt.p90_pred,
                  probSloPct: Math.round((pt.prob_exceed_slo ?? 0) * 100),
                  risk: pt.risk_level
                })).slice(0, 12); // ~1h
                this.loading = false;
              },
              error: (e) => { this.error = this.msg(e); this.loading = false; }
            });
        },
        error: (e) => { this.error = this.msg(e); this.loading = false; }
      });
  }

  badge(risk: 'low' | 'medium' | 'high'): string {
    switch (risk) {
      case 'high': return 'badge badge-high';
      case 'medium': return 'badge badge-med';
      default: return 'badge badge-low';
    }
  }

  private msg(e: any): string {
    try {
      if (e?.error?.error) return e.error.error;
      if (typeof e?.error === 'string') return e.error;
    } catch {}
    return 'Erreur réseau';
  }
}
