import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export type ConfirmDialogData = {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: string;          // e.g. 'help', 'warning'
  color?: 'primary' | 'warn' | 'accent';
};

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title class="flex items-center gap-2">
      <mat-icon>{{ data.icon || 'help' }}</mat-icon>
      {{ data.title || 'Confirmer' }}
    </h2>

    <div mat-dialog-content class="text-[14px] leading-6">
      {{ data.message || 'Voulez-vous continuer ?' }}
    </div>

    <div mat-dialog-actions align="end" class="gap-2">
      <button mat-button (click)="close(false)">{{ data.cancelText || 'Annuler' }}</button>
      <button mat-flat-button [color]="data.color || 'primary'" (click)="close(true)">
        {{ data.confirmText || 'Confirmer' }}
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .flex { display:flex; } .items-center{align-items:center;}
    .gap-2{gap:.5rem;} .text-[14px]{font-size:14px}
    .leading-6{line-height:1.5rem}
    .gap-2[mat-dialog-actions]{display:flex}
  `]
})
export class ConfirmDialogComponent {
  constructor(
    private ref: MatDialogRef<ConfirmDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}
  close(v: boolean) { this.ref.close(v); }
}
