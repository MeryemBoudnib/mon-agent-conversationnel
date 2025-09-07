import {
  Component, OnDestroy, OnInit, ViewChild, ElementRef, HostListener, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule } from '@angular/material/dialog';

import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';

import { AdminService, AdminUser } from '../../services/admin.service';
import { ConfirmService } from '../../shared/confirm-dialog/confirm.service'; // ✅ bon chemin

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [
    CommonModule, RouterModule, ReactiveFormsModule,
    MatTableModule, MatPaginatorModule, MatSortModule,
    MatButtonModule, MatIconModule,
    MatSnackBarModule, MatFormFieldModule, MatInputModule,
    MatTooltipModule, MatDialogModule,
  ],
  templateUrl: './users-page.component.html',
  styleUrls: ['./users-page.component.css'],
})
export class UsersPageComponent implements OnInit, OnDestroy {
  private adminApi: AdminService = inject(AdminService);
  private snack: MatSnackBar = inject(MatSnackBar);
  private confirm: ConfirmService = inject(ConfirmService);   // ✅ typé
  private destroy$ = new Subject<void>();

  displayedColumns: Array<'id'|'email'|'actions'> = ['id','email','actions'];

  all: AdminUser[] = [];
  rows: AdminUser[] = [];

  total = 0;
  page = 0;
  size = 25;
  sort: Sort = { active: 'id', direction: 'asc' };
  searchCtrl = new FormControl<string>('', { nonNullable: true });

  @ViewChild('qInput') qInput!: ElementRef<HTMLInputElement>;

  ngOnInit(): void {
    this.searchCtrl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => { this.page = 0; this.applyView(); });

    this.loadAll();
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  // --- data ---
  loadAll() {
    this.adminApi.getUsers().subscribe({
      next: users => { this.all = users ?? []; this.applyView(); },
      error: _ => {
        this.all = []; this.rows = []; this.total = 0;
        this.snack.open('Erreur chargement utilisateurs', 'OK', { duration: 1500 });
      }
    });
  }

  applyView() {
    const q = (this.searchCtrl.value || '').trim().toLowerCase();

    let data = !q ? [...this.all] :
      this.all.filter(u =>
        String(u.id).includes(q) ||
        (u.email?.toLowerCase().includes(q)) ||
        (u.firstName?.toLowerCase().includes(q)) ||
        (u.lastName?.toLowerCase().includes(q))
      );

    if (this.sort.direction) {
      const dir = this.sort.direction === 'asc' ? 1 : -1;
      const key = this.sort.active;
      data.sort((a: any, b: any) => {
        const va = (a?.[key] ?? '').toString().toLowerCase();
        const vb = (b?.[key] ?? '').toString().toLowerCase();
        if (va < vb) return -1 * dir;
        if (va > vb) return  1 * dir;
        return 0;
      });
    }

    this.total = data.length;
    const start = this.page * this.size;
    const end   = start + this.size;
    this.rows = data.slice(start, end);
  }

  // --- events UI ---
  onPage(e: PageEvent) {
    this.page = e.pageIndex;
    this.size = e.pageSize;
    this.applyView();
  }

  onSort(s: Sort) {
    if (!s.direction) s = { active: 'id', direction: 'asc' };
    this.sort = s; this.page = 0; this.applyView();
  }

  // --- Actions admin ---
  onToggleActive(u: AdminUser) {
    const next = !u.active;

    this.confirm.open({
      message: next ? 'Activer cet utilisateur ?' : 'Désactiver cet utilisateur ?',
      confirmText: next ? 'Activer' : 'Désactiver',
      cancelText: 'Annuler',
      tone: next ? 'default' : 'danger'
    }).subscribe((ok: boolean) => {                // ✅ typé
      if (!ok) return;

      const prev = u.active;
      u.active = next; // optimistic

      this.adminApi.setUserActive(u.id, next).subscribe({
        next: () => {
          this.snack.open(next ? 'Utilisateur activé' : 'Utilisateur désactivé', 'OK', { duration: 1200 });
          this.loadAll();
        },
        error: () => {
          u.active = prev;
          this.snack.open('Action impossible', 'OK', { duration: 1500 });
        }
      });
    });
  }

  onDelete(u: AdminUser) {
    this.confirm.open({
      title: 'Confirmation',
      message: 'Supprimer définitivement cet utilisateur ?',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      tone: 'danger'
    }).subscribe((ok: boolean) => {                // ✅ typé
      if (!ok) return;

      this.adminApi.deleteUser(u.id).subscribe({
        next: () => {
          this.all = this.all.filter(r => r.id !== u.id);
          this.applyView();
          this.snack.open('Utilisateur supprimé', 'OK', { duration: 1200 });
        },
        error: () => this.snack.open('Suppression impossible', 'OK', { duration: 1500 })
      });
    });
  }

  // ---- Raccourcis clavier globaux ----
  @HostListener('document:keydown', ['$event'])
  onGlobalKey(e: KeyboardEvent) {
    const k = e.key.toLowerCase();
    const ctrlk = (e.ctrlKey || e.metaKey) && k === 'k';
    if (ctrlk) { e.preventDefault(); this.qInput?.nativeElement?.focus(); }
    if (k === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (document.activeElement !== this.qInput?.nativeElement) {
        e.preventDefault();
        this.qInput?.nativeElement?.focus();
      }
    }
  }
}
