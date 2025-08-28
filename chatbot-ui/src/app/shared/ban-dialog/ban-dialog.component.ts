import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';

export type BanDialogData = {
  email: string;
};

@Component({
  selector: 'app-ban-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatDatepickerModule, MatNativeDateModule, MatIconModule
  ],
  template: `
    <h2 mat-dialog-title class="flex items-center gap-2">
      <mat-icon color="warn">block</mat-icon>
      Bannir {{data.email}}
    </h2>

    <div mat-dialog-content class="space-y-3">
      <div class="text-[13px] text-muted">
        Choisissez une durée rapide ou une date/heure de fin personnalisée.
      </div>

      <div class="quick-row">
        <button mat-stroked-button (click)="applyPreset(24)">24h</button>
        <button mat-stroked-button (click)="applyPreset(24*7)">7 jours</button>
        <button mat-stroked-button (click)="applyPreset(24*30)">30 jours</button>
      </div>

      <div class="grid">
        <mat-form-field appearance="outline">
          <mat-label>Fin du ban (date)</mat-label>
          <input matInput [matDatepicker]="picker" [(ngModel)]="dateOnly">
          <mat-datepicker #picker></mat-datepicker>
          <button matSuffix mat-icon-button (click)="picker.open()"><mat-icon>event</mat-icon></button>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Heure (HH:mm)</mat-label>
          <input matInput placeholder="23:59" [(ngModel)]="timeOnly">
        </mat-form-field>
      </div>

      <div *ngIf="error" class="err">{{ error }}</div>
    </div>

    <div mat-dialog-actions align="end" class="gap-2">
      <button mat-button (click)="close()">Annuler</button>
      <button mat-flat-button color="warn" (click)="confirm()">Bannir</button>
    </div>
  `,
  styles: [`
    :host { display:block; }
    .flex{display:flex}.items-center{align-items:center}.gap-2{gap:.5rem}
    .text-[13px]{font-size:13px}.text-muted{color:#6b7280}
    .space-y-3> * + * { margin-top: .75rem; }
    .quick-row{display:flex; gap:.5rem; flex-wrap:wrap}
    .grid{display:grid; grid-template-columns: 1fr 1fr; gap:.75rem}
    .err{color:#b91c1c; font-size:12px}
  `]
})
export class BanDialogComponent {
  dateOnly: Date | null = null;
  timeOnly = '23:59';
  error = '';

  constructor(
    private ref: MatDialogRef<BanDialogComponent, Date | null>,
    @Inject(MAT_DIALOG_DATA) public data: BanDialogData
  ) {}

  applyPreset(hours: number) {
    const d = new Date(Date.now() + hours * 3600_000);
    this.dateOnly = d;
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    this.timeOnly = `${hh}:${mm}`;
  }

  confirm() {
    if (!this.dateOnly) { this.error = 'Choisissez une date de fin.'; return; }
    const [hh='23', mm='59'] = (this.timeOnly||'').split(':');
    const dt = new Date(this.dateOnly);
    dt.setHours(Number(hh||'0'), Number(mm||'0'), 0, 0);
    if (dt.getTime() <= Date.now()) { this.error = 'La date/heure doit être dans le futur.'; return; }
    this.ref.close(dt);
  }

  close(){ this.ref.close(null); }
}
