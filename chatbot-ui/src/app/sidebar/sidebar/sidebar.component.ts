// CHEMIN : src/app/sidebar/sidebar/sidebar.component.ts

import { Component, OnInit, OnDestroy, Input } from '@angular/core'; // 1. IMPORTEZ 'Input'
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { RouterModule } from '@angular/router';

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
  // 2. ✅ CORRECTION : La propriété s'appelle 'isExpanded' et elle vient du composant parent (AppComponent).
  // L'annotation @Input() permet de recevoir cette valeur.
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
    this.loadHistory();

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        const parts = e.urlAfterRedirects.split('/');
        const last = parts.pop() || '';
        const id = Number(last);
        this.currentConversationId = isNaN(id) ? null : id;
      });

    this.historyUpdateSubscription = this.chatService.historyUpdated$.subscribe(() => {
      this.loadHistory();
    });
  }

  ngOnDestroy(): void {
    if (this.historyUpdateSubscription) {
      this.historyUpdateSubscription.unsubscribe();
    }
  }

  // 3. ❌ SUPPRESSION : La méthode toggle() n'est plus nécessaire ici.
  // Elle est gérée par le composant parent.

  loadHistory(): void {
    this.chatService.getHistory().subscribe(list => {
      this.conversations = list.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });
    });
  }
  
  newConversation(): void { this.router.navigate(['/chat']); }
  
  selectConversation(id: number): void { this.router.navigate(['/chat', id]); }

  deleteConversation(id: number): void {
    if (!confirm('Supprimer définitivement cette conversation ?')) return;
    this.chatService.deleteConversation(id).subscribe(() => {
      this.chatService.notifyHistoryUpdate();
    });
  }

  deleteAllConversations(): void {
    if (!confirm('Tout supprimer et repartir de 1 ?')) return;
    this.chatService.deleteAllConversations().subscribe(() => {
      this.chatService.notifyHistoryUpdate();
      this.router.navigate(['/chat']);
    });
  }

  onSettings(): void { this.router.navigate(['/parametres']); }

  onLogout(): void { this.authService.logout().subscribe(() => this.router.navigate(['/login'])); }
}