import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export type RenameDialogData = { title: string };

@Component({
  standalone: true,
  selector: 'app-rename-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule
  ],
  template: `
  <div class="cd-wrap">
    <header class="cd-head">
      <div class="cd-badge"><mat-icon>edit</mat-icon></div>
      <h2 class="cd-title">Modifier le titre</h2>
    </header>

    <p class="cd-msg">Entre le nouveau titre de la conversation :</p>

    <mat-form-field appearance="fill" style="width:100%;margin:8px 0 18px;">
      <mat-label>Nouveau titre</mat-label>
      <input matInput [formControl]="ctrl" autocomplete="off" />
    </mat-form-field>

    <footer class="cd-actions">
      <button mat-stroked-button (click)="close(null)">Annuler</button>
      <button mat-flat-button color="primary" [disabled]="ctrl.invalid" (click)="save()">Enregistrer</button>
    </footer>
  </div>
  `,
  styles: [`
    .cd-head{ display:flex; align-items:center; gap:12px; margin-bottom:10px; }
    .cd-badge{ width:36px; height:36px; border-radius:50%;
      display:inline-flex; align-items:center; justify-content:center;
      background: rgba(43,124,255,.10); color:#2b7cff; }
    .cd-title{ margin:0; font-size:1.05rem; font-weight:700; }
    .cd-msg{ margin:8px 0; line-height:1.35; }
    .cd-actions{ display:flex; justify-content:flex-end; gap:10px; }
  `]
})
export class RenameDialogComponent {
  // on crée le contrôle sans valeur...
  ctrl = new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.minLength(1)] });

  // ...puis on injecte les dépendances
  private readonly data = inject<RenameDialogData>(MAT_DIALOG_DATA);
  private readonly ref  = inject(MatDialogRef<RenameDialogComponent, string>);

  constructor() {
    // et on alimente le contrôle ici (après l'injection)
    this.ctrl.setValue(this.data?.title ?? '');
  }

  save(): void {
    const value = this.ctrl.value.trim();
    if (!value) return;
    this.ref.close(value);
  }
  close(result: string | null): void { this.ref.close(result); }
}
