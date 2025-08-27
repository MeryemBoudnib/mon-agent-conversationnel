import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  AdminService,
  MsgPerDay,
  KeywordCountDTO,
  HeatCellDTO,
  AdminUser
} from '../../services/admin.service';
import { of, forkJoin } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  NgApexchartsModule,
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexStroke,
  ApexFill,
  ApexDataLabels
} from 'ng-apexcharts';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatTableModule, MatButtonModule, MatIconModule,
    NgApexchartsModule
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  // KPIs
  stats = { users: 0, activeConversations: 0, avgConvMin: 0 };

  // Users
  users: AdminUser[] = [];
  displayedColumns = ['email', 'role', 'actions'];

  // Charts (messages)
  msgsPerDay: MsgPerDay[] = [];
  heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  maxHeat = 1;

  // Keywords
  keywords: KeywordCountDTO[] = [];
  keywordsEnabled = true;

  // Date range
  fromISO = '';
  toISO = '';

  // Theme
  theme: 'light' | 'dark' = 'light';

  // Area chart (signups)
  signupsSeries: ApexAxisChartSeries = [];
  signupsChart:  ApexChart = { type: 'area', height: 260, toolbar: { show: false } };
  signupsXAxis:  ApexXAxis = { type: 'datetime' };
  signupsStroke: ApexStroke = { curve: 'smooth', width: 2 };
  signupsFill:   ApexFill   = { type: 'gradient' };
  signupsLabels: ApexDataLabels = { enabled: false };

  constructor(private api: AdminService) {}

  ngOnInit(): void {
    // Pré-remplir une période sur 14 jours
    const to = new Date();
    const from = new Date(Date.now() - 13 * 86400000);
    this.toISO = to.toISOString().slice(0, 10);
    this.fromISO = from.toISOString().slice(0, 10);

    // Charger directement au démarrage
    this.applyRange();
  }

  toggleTheme(): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
  }

  private loadKpisAndUsers(): void {
    this.api.getStats()
      .pipe(catchError(() => of({ totalUsers: 0, totalConversations: 0, avgConvMin: 0 })))
      .subscribe(s => {
        this.stats.users = s.totalUsers ?? 0;
        this.stats.activeConversations = s.totalConversations ?? 0;
        // avgConvMin est mis à jour par loadAnalytics() via /avg-conv-duration
      });

    this.api.getUsers()
      .pipe(catchError(() => of([] as AdminUser[])))
      .subscribe(u => this.users = u);
  }

  loadAnalytics(): void {
    const msgs$ = this.api.msgsPerDay(this.fromISO, this.toISO)
      .pipe(catchError(() => of<MsgPerDay[]>([])));

    const avg$  = this.api.avgConv(this.fromISO, this.toISO)
      .pipe(map(res => Number((res as any)?.value ?? 0)), catchError(() => of(0)));

    forkJoin([msgs$, avg$]).subscribe(([rows, avg]) => {
      this.msgsPerDay = rows ?? [];
      this.stats.avgConvMin = avg;
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

    // Keywords
    if (this.keywordsEnabled) {
      this.api.topKeywords(this.fromISO, this.toISO)
        .pipe(catchError(() => { this.keywordsEnabled = false; return of([] as KeywordCountDTO[]); }))
        .subscribe(k => this.keywords = k ?? []);
    }

    // Signups (area chart)
    this.api.signupsPerDay(this.fromISO, this.toISO)
      .pipe(catchError(() => of([])))
      .subscribe(rows => {
        const points = rows.map(r => ({ x: new Date(r.date).toISOString(), y: Number(r.count) }));
        this.signupsSeries = [{ name: 'Inscriptions', data: points }];
      });
  }

  get maxPerDay(): number {
    return this.msgsPerDay.reduce((m, x) => Math.max(m, Number(x?.msgs ?? 0)), 1);
  }

  applyRange(): void {
    if (!this.fromISO || !this.toISO) return;
    this.loadKpisAndUsers();
    this.loadAnalytics();
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

  // Compat si ton ancien template appelait encore disableUser
  disableUser(id: number): void { this.setRole(id, 'USER'); }

  weekDayName(i: number): string {
    return ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][i] ?? String(i);
  }
}
