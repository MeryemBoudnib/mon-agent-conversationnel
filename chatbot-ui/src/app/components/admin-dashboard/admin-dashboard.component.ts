import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialogModule } from '@angular/material/dialog';

import {
  NgApexchartsModule,
  ApexAxisChartSeries, ApexChart, ApexXAxis, ApexStroke, ApexDataLabels,
  ApexFill, ApexLegend, ApexYAxis, ApexPlotOptions, ApexTooltip, ApexGrid, ApexTheme, ApexAnnotations
} from 'ng-apexcharts';

import { of, forkJoin, interval, Subject } from 'rxjs';
import { catchError, map, startWith, switchMap, takeUntil } from 'rxjs/operators';

import {
  AdminService, MsgPerDay, HeatCellDTO, BotLatencyRow,
  ForecastResponse, SummaryResponse
} from '../../services/admin.service';
import { AuthService } from '../../auth/auth.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatSnackBarModule, MatMenuModule, MatDividerModule, MatDialogModule,
    NgApexchartsModule
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css'],
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  theme: 'light' | 'dark' = 'light';
  fromISO = '';
  toISO = '';

  // Header profil
  currentUserEmail = '';
  initials = 'AD';

  stats = { users: 0, activeConversations: 0, avgConvMin: 0 };

  msgsPerDay: MsgPerDay[] = [];
  heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  maxHeat = 1;

  /* ===== Inscriptions ===== */
  signupsSeries: ApexAxisChartSeries = [];
  signupsChart:  ApexChart  = { type: 'area', height: 260, toolbar: { show: false } };
  signupsXAxis:  ApexXAxis  = { type: 'datetime', labels: { datetimeUTC: false } };
  signupsStroke: ApexStroke = { curve: 'smooth', width: 2 };
  signupsFill:   ApexFill   = { type: 'gradient' };
  signupsLabels: ApexDataLabels = { enabled: false };
  signupsLegend: ApexLegend = { position: 'top' };

  /* ===== Latence (fenêtre glissante) ===== */
  latSeries: ApexAxisChartSeries = [];
  latChart:  ApexChart  = { type: 'line', height: 260, toolbar: { show: false }, animations: { enabled: true } };
  latXAxis:  ApexXAxis  = { type: 'datetime', labels: { datetimeUTC: false } };
  latStroke: ApexStroke = { curve: 'smooth', width: 2 };
  latLabels: ApexDataLabels = { enabled: false };
  latLegend: ApexLegend = { position: 'top' };
  latTooltip: ApexTooltip = { x: { format: 'HH:mm:ss' } };
  latAnnotations: ApexAnnotations = { yaxis: [] };
  sloP90 = 0.8;

  /** Fenêtre large (24h) pour être sûr d’avoir des points même si l’agrégation est à 5–60 min. */
  latencyWindowMinutes = 60 * 24;
  /** Période de refresh (5s) */
  latencyRefreshEveryMs  = 5000;

  /* ===== Nowcast / Summary ===== */
  iaSummary?: SummaryResponse;
  iaForecast?: ForecastResponse;
  summaryHTML: SafeHtml | null = null;

  /* ===== Messages par jour ===== */
  msgsSeriesChart: ApexAxisChartSeries = [];
  msgsChart:  ApexChart = { type: 'bar', height: 320, toolbar: { show: false } };
  msgsXAxis:  ApexXAxis = {
    categories: [],
    labels: { rotate: -45, trim: true, hideOverlappingLabels: true }
  };
  msgsYAxis:  ApexYAxis = {
    tickAmount: 4, forceNiceScale: true, decimalsInFloat: 0,
    labels: { formatter: v => String(Math.round(v)) }
  };
  msgsPlotOptions: ApexPlotOptions = {
    bar: { columnWidth: '45%', borderRadius: 6, dataLabels: { position: 'top' } }
  };
  msgsDataLabels: ApexDataLabels = {
    enabled: true,
    formatter: (val: number) => (val ?? 0).toString(),
    offsetY: -16,
    style: { fontSize: '12px', fontWeight: 700 }
  };
  msgsFill:   ApexFill   = { opacity: 0.95 };
  msgsStroke: ApexStroke = { show: true, width: 1 };
  msgsGrid:   ApexGrid   = { strokeDashArray: 3, padding: { left: 8, right: 8 } };
  msgsTheme:  ApexTheme  = { mode: this.theme === 'dark' ? 'dark' : 'light' };
  msgsTooltip: ApexTooltip = {
    x: { show: true },
    y: { formatter: (val: number) => `${val ?? 0} msg` }
  };

  constructor(
    private api: AdminService,
    private snack: MatSnackBar,
    private router: Router,
    private auth: AuthService,
    private sanitizer: DomSanitizer,
    private http: HttpClient
  ) {}

  /* ====================== Cycle de vie ====================== */

  ngOnInit(): void {
    // Profil
    this.http.get<{email:string}>('/api/user/me').subscribe({
      next: (u) => {
        this.currentUserEmail = u?.email || 'admin@example.com';
        this.initials = this.computeInitials(this.currentUserEmail);
      },
      error: _ => {
        this.currentUserEmail = 'admin@example.com';
        this.initials = this.computeInitials(this.currentUserEmail);
      }
    });

    // Période par défaut : 14 derniers jours (pour les sections non temps réel)
    const to = new Date();
    const from = new Date(Date.now() - 13 * 86400000);
    this.toISO = to.toISOString().slice(0, 10);
    this.fromISO = from.toISOString().slice(0, 10);

    // SLO p90 (annotation)
    this.refreshSloAnnotation();

    // Analytique par date
    this.applyRange();

    // Boucle temps réel latence
    this.startLatencyLoop();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ====================== Utils ====================== */

  private computeInitials(v: string): string {
    if (!v) return 'AD';
    const name = v.split('@')[0];
    const parts = name.split(/[.\-_ ]+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  toggleTheme(): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    const body = document.body;
    if (this.theme === 'dark') body.classList.add('dark'); else body.classList.remove('dark');
    this.msgsTheme = { ...this.msgsTheme, mode: this.theme === 'dark' ? 'dark' : 'light' };
  }

  /** Nom de jour pour la heatmap (adapter l’ordre selon ton backend) */
  weekDayName(i: number): string {
    // Si dow=0 → Lundi, garde ceci. Si dow=0→Dimanche, remplace par ['Dim','Lun',...].
    const jours = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    return jours[i] ?? '';
  }

  /* ====================== Chargements initiaux ====================== */

  applyRange(): void {
    if (!this.fromISO || !this.toISO) return;
    this.loadKpis();
    this.loadAnalyticsExceptLatency();
  }

  private loadKpis(): void {
    this.api.getStats()
      .pipe(catchError(() => of({ totalUsers: 0, totalConversations: 0, avgConvMin: 0 })))
      .subscribe(s => {
        this.stats.users = s.totalUsers ?? 0;
        this.stats.activeConversations = s.totalConversations ?? 0;
      });
  }

  private loadAnalyticsExceptLatency(): void {
    const msgs$ = this.api.msgsPerDay(this.fromISO, this.toISO)
      .pipe(catchError(() => of<MsgPerDay[]>([])));

    const avg$  = this.api.avgConv(this.fromISO, this.toISO)
      .pipe(map(res => Number(res?.value ?? 0)), catchError(() => of(0)));

    forkJoin([msgs$, avg$]).subscribe(([rows, avg]) => {
      this.msgsPerDay = rows ?? [];
      this.buildMsgsChart();
      this.stats.avgConvMin = avg;
    });

    // Heatmap (unique, ici)
    this.heat = Array.from({ length: 7 }, () => Array(24).fill(0));
    this.maxHeat = 1;
    this.api.heatmap(this.fromISO, this.toISO)
      .pipe(catchError(() => of<HeatCellDTO[]>([])))
      .subscribe((cells: HeatCellDTO[]) => {
        for (const c of (cells ?? [])) {
          this.heat[c.dow][c.hour] = c.count;
          if (c.count > this.maxHeat) this.maxHeat = c.count;
        }
      });

    // Inscriptions
    this.api.signupsPerDay(this.fromISO, this.toISO)
      .pipe(catchError(() => of([])))
      .subscribe(rows => {
        const points = (rows ?? []).map((r: any) => ({ x: new Date(r.date).toISOString(), y: Number(r.count) }));
        this.signupsSeries = [{ name: 'Inscriptions', data: points }];
      });
  }

  private buildMsgsChart(): void {
    const categories = this.msgsPerDay.map(p => p.d);
    const data = this.msgsPerDay.map(p => Number(p.msgs || 0));
    this.msgsXAxis = { ...this.msgsXAxis, categories };
    this.msgsSeriesChart = [{ name: 'Messages', data }];
  }

  /* ====================== Latence temps réel ====================== */

  private now() { return new Date(); }
  private minusMinutes(d: Date, m: number) { return new Date(d.getTime() - m * 60_000); }

  private startLatencyLoop(): void {
    interval(this.latencyRefreshEveryMs)
      .pipe(
        startWith(0),
        switchMap(() => {
          const to = this.now();
          const from = this.minusMinutes(to, this.latencyWindowMinutes);
          console.log('[UI] latency window', { from, to });
          return this.api.latencyWindow(from, to);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(rows => this.updateLatencyChart(rows ?? []));
  }

  /** Parse robuste: accepte epoch(ms) | "YYYY-MM-DD HH:mm:ss" | ISO, filtre les NaN */
  private updateLatencyChart(rows: BotLatencyRow[]): void {
    console.log('[UI] latency rows reçus (n=', rows?.length ?? 0, ')', rows?.slice?.(0, 3) ?? rows);

    // ⬇⬇⬇ PATCH : accepte string OU number
    const toEpoch = (t: string | number): number => {
      if (t === null || t === undefined) return NaN;
      if (typeof t === 'number') return t; // déjà epoch ms
      const norm = t.includes('T') ? t : t.replace(' ', 'T'); // "YYYY-MM-DD HH:mm:ss" -> ISO-like
      const n = Date.parse(norm);
      return Number.isNaN(n) ? NaN : n;
    };

    const make = (key: 'p50'|'p90'|'avg') =>
      (rows ?? [])
        .map(r => {
          const x = toEpoch(r.ts);
          const y = Number((r as any)[key]);
          return (Number.isNaN(x) || Number.isNaN(y)) ? null : [x, y] as [number, number];
        })
        .filter((pt): pt is [number, number] => !!pt);

    this.latSeries = [
      { name: 'p50',     data: make('p50') },
      { name: 'p90',     data: make('p90') },
      { name: 'moyenne', data: make('avg') },
    ];
  }

  private refreshSloAnnotation(): void {
    this.latAnnotations = {
      yaxis: [{
        y: this.sloP90,
        borderColor: '#f59e0b',
        label: { text: `SLO p90 = ${this.sloP90}s`, style: { fontSize: '12px', fontWeight: 700 } }
      }]
    };
  }

  /* ====================== IA ====================== */

  runSummary(): void {
    this.api.metricsSummary(this.fromISO, this.toISO, this.sloP90)
      .pipe(catchError(() => of<SummaryResponse>({
        ok: false, summary_text: 'Erreur: résumé indisponible pour le moment.', data: {}
      } as any)))
      .subscribe(res => {
        this.iaSummary = res;
        this.summaryHTML = this.renderSummary(res?.summary_text || '');
      });
  }

  runForecast(): void {
    this.api.metricsForecastRisk({ slo_p90: this.sloP90, horizon_min: 60, bucket_min: 5, alpha: 0.35 })
      .pipe(catchError(() => of<ForecastResponse>({
        ok: false, alert: false, slo_p90: this.sloP90, bucket_min: 5, alpha: 0.35, overall_max_prob: 0, points: []
      } as any)))
      .subscribe(res => this.iaForecast = res);
  }

  get iaStatus(): string {
    if (!this.iaSummary) return 'Analyse en cours';
    const mean = this.iaSummary.data?.p90_mean;
    if (mean !== undefined) return mean <= this.sloP90 ? '✅ conforme' : '⚠️ à surveiller';
    return 'Analyse en cours';
  }

  /* ====================== Markdown rendu ====================== */

  private renderSummary(md: string): SafeHtml {
    const html = this.markdownToHtml(md || '');
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  private markdownToHtml(src: string): string {
    const esc = (s: string) =>
      s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    let text = esc(src);

    text = text.replace(/^### (.*)$/gm, '<h5>$1</h5>');
    text = text.replace(/^## (.*)$/gm,  '<h4>$1</h4>');
    text = text.replace(/^# (.*)$/gm,   '<h3>$1</h3>');
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

    const lines = text.split(/\r?\n/);
    const out: string[] = [];
    let inUl = false;
    const flushUl = () => { if (inUl) { out.push('</ul>'); inUl = false; } };

    for (const ln of lines) {
      const m = ln.match(/^\s*[\*\-]\s+(.*)$/);
      if (m) {
        if (!inUl) { out.push('<ul>'); inUl = true; }
        out.push(`<li>${m[1]}</li>`);
      } else if (ln.trim() === '') {
        flushUl();
        out.push('<br/>');
      } else {
        flushUl();
        out.push(`<p>${ln}</p>`);
      }
    }
    flushUl();
    return out.join('\n');
  }

  /* ====================== Auth ====================== */

  logout(): void {
    this.auth.logout?.();
    this.snack.open('Déconnecté avec succès', 'OK', { duration: 1500 });
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}

