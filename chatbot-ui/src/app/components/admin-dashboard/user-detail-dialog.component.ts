import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AdminService, AdminUser } from '../../services/admin.service';
import { ConfirmService } from '../../confirm.service';

@Component({
  selector: 'app-user-detail-dialog',
  standalone: true,
  imports: [
    CommonModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatSnackBarModule, MatSlideToggleModule, MatTooltipModule
  ],
  templateUrl: './user-detail-dialog.component.html',
  styleUrls: ['./user-detail-dialog.component.css'],
})
export class UserDetailDialogComponent {
  loading = false;

  constructor(
    public ref: MatDialogRef<UserDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AdminUser,
    private admin: AdminService,
    private snack: MatSnackBar,
    private confirm: ConfirmService
  ) {}

  close(): void { this.ref.close(this.data); }

  // Active / désactive l'utilisateur avec modale custom
  toggleActive(): void {
    const next = !this.data.active;

    // Message d'avertissement plus explicite côté désactivation
    const message = next
      ? 'Activer cet utilisateur ?'
      : 'Désactiver cet utilisateur ?\n\n⚠️ L’utilisateur ne pourra plus se connecter à l’interface (chat, etc.).';

    this.confirm.open({
      title: 'Confirmation',
      message,
      confirmText: next ? 'Activer' : 'Désactiver',
      cancelText: 'Annuler',
      tone: next ? 'default' : 'danger'
    }).subscribe(ok => {
      if (!ok) return;

      const prev = this.data.active;
      this.data.active = next;           // optimistic UI
      this.loading = true;

      this.admin.setUserActive(this.data.id, next).subscribe({
        next: () => {
          // Optionnel : invalider la/les session(s) si le service le propose
          if (next === false && typeof (this.admin as any).forceSignOut === 'function') {
            try {
              (this.admin as any).forceSignOut(this.data.id).subscribe({
                error: () => { /* silencieux : ce call est best-effort */ }
              });
            } catch { /* ignore */ }
          }

          this.loading = false;

          if (next) {
            this.snack.open('Utilisateur activé', 'OK', { duration: 1500 });
          } else {
            // Alerte claire quand désactivé
            this.snack.open(
              'Utilisateur désactivé. Il ne pourra plus se connecter. Informez-le de contacter l’administrateur/support.',
              'OK',
              { duration: 4000 }
            );
          }

          // renvoyer l’état au parent (utile si liste à rafraîchir)
          this.ref.close({ updated: true, id: this.data.id, active: next });
        },
        error: () => {
          this.loading = false;
          this.data.active = prev;       // rollback
          this.snack.open('Action impossible', 'OK', { duration: 1500 });
        }
      });
    });
  }

  // Suppression définitive avec modale custom (DANGER)
  deleteUser(): void {
    this.confirm.open({
      title: 'Confirmation',
      message: 'Supprimer définitivement cet utilisateur ?',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      tone: 'danger'
    }).subscribe(ok => {
      if (!ok) return;

      this.loading = true;
      this.admin.deleteUser(this.data.id).subscribe({
        next: () => {
          this.loading = false;
          this.snack.open('Utilisateur supprimé', 'OK', { duration: 1200 });
          this.ref.close({ deleted: true, id: this.data.id });
        },
        error: () => {
          this.loading = false;
          this.snack.open('Suppression impossible', 'OK', { duration: 1500 });
        }
      });
    });
  }
}
