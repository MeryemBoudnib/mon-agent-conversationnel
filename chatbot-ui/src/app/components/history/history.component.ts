import { Component, OnInit }    from '@angular/core';
import { Router }               from '@angular/router';
import { CommonModule }         from '@angular/common';
import { MatIconModule }        from '@angular/material/icon';
import { ChatService, Conversation } from '../../services/chat.service';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.css']
})
export class HistoryComponent implements OnInit {
  conversations: Conversation[] = [];

  constructor(
    private chatService: ChatService,
    private router: Router                   // ← on injecte Router
  ) {}

  ngOnInit(): void {
    this.loadHistory();
  }

  loadHistory(): void {
    this.chatService.getHistory()
      .subscribe(list => this.conversations = list);
  }

  delete(id: number): void {
    if (!confirm('Supprimer définitivement cette conversation ?')) return;
    this.chatService.deleteConversation(id)
      .subscribe(() => this.loadHistory());
  }
deleteAllConversations(): void {
  if (!confirm('Tout supprimer et repartir de 1 ?')) return;
  this.chatService.deleteAllConversations()
    .subscribe(() => {
      this.conversations = [];
      this.router.navigate(['/chat']);
    });
}


  /** ← NOUVELLE MÉTHODE pour la navigation */
  viewConversation(id: number): void {
    this.router.navigate(['/chat', id]);
  }
}