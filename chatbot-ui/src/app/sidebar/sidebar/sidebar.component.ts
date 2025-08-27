import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';

import { ChatService, Conversation } from '../../services/chat.service';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [ CommonModule, RouterModule, MatIconModule, MatButtonModule, MatDividerModule, MatTooltipModule ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit, OnDestroy {
  @Input() isExpanded: boolean = true;

  conversations: Conversation[] = [];
  currentConversationId: number | null = null;
  private historyUpdateSubscription?: Subscription;

  constructor(
    private chatService: ChatService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.loadHistory();
      this.historyUpdateSubscription = this.chatService.historyUpdated$
        .subscribe(() => this.loadHistory());
    }

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        const last = e.urlAfterRedirects.split('/').pop() || '';
        const id = Number(last);
        this.currentConversationId = isNaN(id) ? null : id;
      });
  }

  ngOnDestroy(): void {
    this.historyUpdateSubscription?.unsubscribe();
  }

  loadHistory(): void {
    this.chatService.getHistory().subscribe(list => {
      this.conversations = (list || []).sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da;
      });
    });
  }

  newConversation(): void { this.router.navigate(['/chat']); }
  selectConversation(id: number): void { this.router.navigate(['/chat', id]); }

  deleteConversation(id: number): void {
    if (!confirm('Supprimer définitivement cette conversation ?')) return;
    this.chatService.deleteConversation(id).subscribe(() => this.chatService.notifyHistoryUpdate());
  }

  deleteAllConversations(): void {
    if (!confirm('Tout supprimer et repartir de 1 ?')) return;
    this.chatService.deleteAllConversations().subscribe(() => {
      this.chatService.notifyHistoryUpdate();
      this.router.navigate(['/chat']);
    });
  }

  onSettings(): void { this.router.navigate(['/parametres']); }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
