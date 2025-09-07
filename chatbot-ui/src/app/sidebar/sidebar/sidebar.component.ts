import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

import { ChatService, Conversation } from '../../services/chat.service';
import { AuthService } from '../../auth/auth.service';
import { ConfirmService } from '../../shared/confirm-dialog/confirm.service';

// ⬇️ IMPORTE le composant standalone du dialogue de renommage
import { RenameDialogComponent } from '../../shared/rename-dialog/rename-dialog.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatMenuModule,
    MatDialogModule, // ⬅️ nécessaire pour ouvrir un dialog
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit, OnDestroy {
  @Input() isExpanded: boolean = true;

  conversations: Conversation[] = [];
  currentConversationId: number | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private chatService: ChatService,
    private router: Router,
    private authService: AuthService,
    private confirm: ConfirmService,
    private snack: MatSnackBar,
    private dialog: MatDialog, // ⬅️ injection du MatDialog
  ) {}

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.loadHistory();
      this.chatService.historyUpdated$
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => this.loadHistory());
    }

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((e: NavigationEnd) => {
        const last = e.urlAfterRedirects.split('/').pop() || '';
        const id = Number(last);
        this.currentConversationId = isNaN(id) ? null : id;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadHistory(): void {
    this.chatService.getHistory().subscribe({
      next: (list) => {
        this.conversations = (list || []).sort((a, b) => {
          const da = a.date ? new Date(a.date).getTime() : 0;
          const db = b.date ? new Date(b.date).getTime() : 0;
          return db - da;
        });
      },
      error: (err) => {
        if (err?.status === 401 || err?.status === 403) {
          this.authService.logout();
          this.router.navigate(['/login']);
        } else {
          this.snack.open('Erreur lors du chargement de l’historique', 'OK', { duration: 2500 });
        }
      }
    });
  }

  newConversation(): void { this.router.navigate(['/chat']); }
  selectConversation(id: number): void { this.router.navigate(['/chat', id]); }

  /** Ouvre la boîte de dialogue pour renommer le titre */
  renameConversation(conv: Conversation): void {
    const ref = this.dialog.open(RenameDialogComponent, {
      data: { title: conv.title },
      width: '480px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: true,
      backdropClass: 'confirm-dialog-backdrop',
      panelClass: ['confirm-dialog-surface'],
    });

    ref.afterClosed().subscribe((newTitle: string | null) => {
      if (!newTitle || newTitle.trim() === conv.title) return;
      this.chatService.updateConversation(conv.id, { title: newTitle.trim() })
        .subscribe({
          next: () => {
            this.snack.open('Titre modifié', 'OK', { duration: 1500 });
            this.chatService.notifyHistoryUpdate();
          },
          error: () => this.snack.open('Échec de modification', 'OK', { duration: 2500 })
        });
    });
  }

  deleteConversation(id: number): void {
    this.confirm.open({
      title: 'Supprimer la conversation',
      message: 'Voulez-vous supprimer définitivement cette conversation ?',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      tone: 'danger'
    }).subscribe((ok: boolean) => {
      if (!ok) return;
      this.chatService.deleteConversation(id).subscribe({
        next: () => {
          if (this.currentConversationId === id) {
            this.router.navigate(['/chat']);
          }
          this.chatService.notifyHistoryUpdate();
          this.snack.open('Conversation supprimée', 'OK', { duration: 1500 });
        },
        error: () => this.snack.open('Échec de suppression', 'OK', { duration: 2500 })
      });
    });
  }

  /** Purge uniquement MES conversations (DELETE /api/conversations/me) */
  deleteAllConversations(): void {
    this.confirm.open({
      title: 'Purger mon historique',
      message: 'Supprimer tous les chats ?',
      confirmText: 'Tout supprimer ',
      cancelText: 'Annuler',
      tone: 'danger'
    }).subscribe((ok: boolean) => {
      if (!ok) return;
      this.chatService.deleteAllMine().subscribe({
        next: () => {
          this.chatService.notifyHistoryUpdate();
          this.router.navigate(['/chat']);
          this.snack.open('Mon historique a été purgé', 'OK', { duration: 1500 });
        },
        error: () => this.snack.open('Échec de la purge', 'OK', { duration: 2500 })
      });
    });
  }

  onSettings(): void { this.router.navigate(['/parametres']); }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
