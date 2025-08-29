import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';

import {
  AdminService,
  AdminUser,
  MsgPerDay,
  HeatCellDTO,
  BotLatencyRow,
  ForecastPoint,
  ForecastResponse,
  SummaryResponse,
} from '../../services/admin.service';

import {
  NgApexchartsModule,
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexStroke,
  ApexDataLabels,
  ApexFill,
  ApexLegend
} from 'ng-apexcharts';

import { of, forkJoin } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatTableModule,
    NgApexchartsModule
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css'],
})
export class AdminDashboardComponent implements OnInit {

  // Theme
  theme: 'light' | 'dark' = 'light';

  // Date range ISO (yyyy-MM-dd)
  fromISO = '';
  toISO = '';

  // KPIs
  stats = { users: 0, activeConversations: 0, avgConvMin: 0 };

  // Users
  users: AdminUser[] = [];
  displayedColumns = ['id', 'email', 'role', 'actions'];

  // Messages / heatmap
  msgsPerDay: MsgPerDay[] = [];
  heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  maxHeat = 1;

  // Signups (area chart)
  signupsSeries: ApexAxisChartSeries = [];
  signupsChart:  ApexChart        = { type: 'area', height: 260, toolbar: { show: false } };
  signupsXAxis:  ApexXAxis        = { type: 'datetime' };
  signupsStroke: ApexStroke       = { curve: 'smooth', width: 2 };
  signupsFill:   ApexFill         = { type: 'gradient' };
  signupsLabels: ApexDataLabels   = { enabled: false };
  signupsLegend: ApexLegend       = { position: 'top' };

  // Latency chart (p50/p90/avg)
  latSeries: ApexAxisChartSeries = [];
  latChart:  ApexChart  = { type: 'line', height: 260, toolbar: { show: false } };
  latXAxis:  ApexXAxis  = { type: 'datetime' };
  latStroke: ApexStroke = { curve: 'smooth', width: 2 };
  latLabels: ApexDataLabels = { enabled: false };
  latLegend: ApexLegend = { position: 'top' };

  // IA controls
  sloP90 = 0.8;
  iaSummary?: SummaryResponse;
  iaForecast?: ForecastResponse;

  constructor(private api: AdminService) {}

  ngOnInit(): void {
    const to = new Date();
    const from = new Date(Date.now() - 13 * 86400000);
    this.toISO = to.toISOString().slice(0, 10);
    this.fromISO = from.toISOString().slice(0, 10);
    this.applyRange();
  }

  toggleTheme(): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    // Applique une classe .dark sur <body> si voulu
    const body = document.body;
    if (this.theme === 'dark') body.classList.add('dark'); else body.classList.remove('dark');
  }

  applyRange(): void {
    if (!this.fromISO || !this.toISO) return;
    this.loadKpisAndUsers();
    this.loadAnalytics();
  }

  private loadKpisAndUsers(): void {
    this.api.getStats()
      .pipe(catchError(() => of({ totalUsers: 0, totalConversations: 0, avgConvMin: 0 })))
      .subscribe(s => {
        this.stats.users = s.totalUsers ?? 0;
        this.stats.activeConversations = s.totalConversations ?? 0;
      });

    this.api.getUsers()
      .pipe(catchError(() => of([] as AdminUser[])))
      .subscribe(u => this.users = u);
  }

  loadAnalytics(): void {
    const msgs$ = this.api.msgsPerDay(this.fromISO, this.toISO)
      .pipe(catchError(() => of<MsgPerDay[]>([])));

    const avg$  = this.api.avgConv(this.fromISO, this.toISO)
      .pipe(map(res => Number(res?.value ?? 0)), catchError(() => of(0)));

    const lat$  = this.api.latencyWindow(this.fromISO, this.toISO)
      .pipe(catchError(() => of<BotLatencyRow[]>([])));

    forkJoin([msgs$, avg$, lat$]).subscribe(([rows, avg, lat]) => {
      // messages chart
      this.msgsPerDay = rows ?? [];
      this.stats.avgConvMin = avg;

      // latency -> Apex series
      const categories: string[] = (lat ?? []).map(p => new Date(p.ts).toISOString());
      this.latSeries = [
        { name: 'p50',   data: (lat ?? []).map(p => Number(p.p50)) },
        { name: 'p90',   data: (lat ?? []).map(p => Number(p.p90)) },
        { name: 'moyenne', data: (lat ?? []).map(p => Number(p.avg)) },
      ];
      this.latXAxis = { ...this.latXAxis, categories };
    });

    // Heatmap
    this.heat = Array.from({ length: 7 }, () => Array(24).fill(0));
    this.maxHeat = 1;
    this.api.heatmap(this.fromISO, this.toISO)
      .pipe(catchError(() => of<HeatCellDTO[]>([])))
      .subscribe(cells => {
        for (const c of (cells ?? [])) {
          this.heat[c.dow][c.hour] = c.count;
          if (c.count > this.maxHeat) this.maxHeat = c.count;
        }
      });

    // Signups
    this.api.signupsPerDay(this.fromISO, this.toISO)
      .pipe(catchError(() => of([])))
      .subscribe(rows => {
        const points = (rows ?? []).map(r => ({ x: new Date(r.date).toISOString(), y: Number(r.count) }));
        this.signupsSeries = [{ name: 'Inscriptions', data: points }];
      });
  }

  get maxPerDay(): number {
    return this.msgsPerDay.reduce((m, x) => Math.max(m, x.msgs || 0), 1);
  }

  setRole(id: number, role: 'USER' | 'ADMIN'): void {
    this.api.setRole(id, role).subscribe({
      next: () => {
        this.api.getUsers()
          .pipe(catchError(() => of([] as AdminUser[])))
          .subscribe(u => this.users = u);
      },
      error: err => console.error('Erreur setRole', err)
    });
  }
  disableUser(id: number): void { this.setRole(id, 'USER'); }
  weekDayName(i: number): string {
    return ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][i] ?? String(i);
  }

  // ---- IA actions placées dans le bloc Latence
  runSummary(): void {
    this.api.metricsSummary(this.fromISO, this.toISO, this.sloP90)
      .pipe(catchError(() => of<SummaryResponse>({
        ok: false, summary_text: 'Erreur: résumé indisponible pour le moment.', data: {}
      } as any)))
      .subscribe(res => this.iaSummary = res);
  }

  runForecast(): void {
    this.api.metricsForecastRisk({ slo_p90: this.sloP90, horizon_min: 60, bucket_min: 5, alpha: 0.35 })
      .pipe(catchError(() => of<ForecastResponse>({
        ok: false, alert: false, slo_p90: this.sloP90, bucket_min: 5, alpha: 0.35, overall_max_prob: 0, points: []
      } as any)))
      .subscribe(res => this.iaForecast = res);
  }
}
