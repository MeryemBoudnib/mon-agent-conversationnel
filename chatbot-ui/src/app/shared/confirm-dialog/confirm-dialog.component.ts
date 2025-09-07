import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export type ConfirmDialogData = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'default' | 'danger';
};

@Component({
  standalone: true,
  selector: 'app-confirm-dialog',
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
  <div class="cd-wrap" [class.danger]="data.tone==='danger'">
    <header class="cd-head">
      <div class="cd-badge" [class.bad]="data.tone==='danger'">
        <mat-icon>{{ data.tone==='danger' ? 'warning' : 'help' }}</mat-icon>
      </div>
      <h2 class="cd-title">
        {{ data.title || (data.tone==='danger' ? 'Action irréversible' : 'Confirmation') }}
      </h2>
    </header>

    <p class="cd-msg">{{ data.message }}</p>

    <footer class="cd-actions">
      <button mat-stroked-button (click)="close(false)">
        {{ data.cancelText || 'Annuler' }}
      </button>

      <button mat-flat-button
              [color]="data.tone==='danger' ? 'warn' : 'primary'"
              (click)="close(true)">
        {{ data.confirmText || 'OK' }}
      </button>
    </footer>
  </div>
  `,
  styles: [`
    .cd-wrap{ padding:20px 18px; }
    .cd-head{ display:flex; align-items:center; gap:12px; margin-bottom:10px; }
    .cd-badge{ width:36px; height:36px; border-radius:50%;
      display:inline-flex; align-items:center; justify-content:center;
      background: rgba(43,124,255,.10); color:#2b7cff; }
    .cd-badge.bad{ background: rgba(239,68,68,.10); color:#ef4444; }
    .cd-title{ margin:0; font-size:1.05rem; font-weight:700; }
    .cd-msg{ margin:8px 0 18px; line-height:1.35; }
    .cd-actions{ display:flex; justify-content:flex-end; gap:10px; }
  `]
})
export class ConfirmDialogComponent {
  data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<ConfirmDialogComponent, boolean>);
  close(ok: boolean) { this.ref.close(ok); }
}
