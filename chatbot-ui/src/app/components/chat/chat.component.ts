// CHEMIN : src/app/components/chat/chat.component.ts
import {
  Component, OnInit, AfterViewChecked, ViewChild, ElementRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MarkdownModule } from 'ngx-markdown';

import { ChatService, Message } from '../../services/chat.service';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MarkdownModule
  ],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit, AfterViewChecked {
  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  messages: Message[] = [];
  newMessage = '';
  currentConversationId: number | null = null;

  constructor(
    private chatService: ChatService,
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      if (!this.auth.isLoggedIn()) return; // pas loggé → stop

      const idParam = params['id'];
      this.messages = [];
      this.newMessage = '';

      if (idParam) {
        const id = Number(idParam);
        this.currentConversationId = id;
        this.loadMessages(id);
      } else {
        this.startNewConversation();
      }
    });
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  private loadMessages(id: number): void {
    this.chatService.getConversationMessages(id).subscribe(msgs => {
      this.messages = (msgs || [])
        .filter(m => m.content && m.content.trim().length > 0)
        .sort((a, b) => {
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeA - timeB;
        });
    });
  }

  private startNewConversation(): void {
    // 👉 Appel sans argument (createConversation() ne prend rien)
    this.chatService.createConversation().subscribe(conv => {
      this.currentConversationId = conv.id;
      this.chatService.notifyHistoryUpdate();
      this.router.navigate(['/chat', conv.id]);
    });
  }

  sendMessage(): void {
    const text = this.newMessage.trim();
    if (!text || this.currentConversationId == null) return;

    const isFirstUserMessage = this.messages.every(m => m.role !== 'user');

    const userMsg: Message = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };
    this.messages.push(userMsg);
    this.newMessage = '';

    this.chatService.saveMessage(this.currentConversationId, 'user', text).subscribe(() => {
      if (isFirstUserMessage) this.chatService.notifyHistoryUpdate();

      const triggerKeywords = [
        'combien de conversations', 'nombre de conversations', 'combien de messages',
        'dernier message', 'date de la dernière conversation', 'quelle est la version',
        'nombre de mots', 'durée moyenne', 'plus longue conversation'
      ];

      const lower = text.toLowerCase();
      const isSpecial = triggerKeywords.some(kw => lower.includes(kw));
      const response$ = isSpecial
        ? this.chatService.handleChat(text)
        : this.chatService.askAI(text);

      response$.subscribe(res => {
        const content = res?.reply?.trim();
        this.pushBotMessage(content || '❌ Je n’ai pas pu trouver de réponse à cette question.');
      });
    });
  }

  private pushBotMessage(content: string) {
    const botMsg: Message = {
      role: 'bot',
      content,
      timestamp: new Date().toISOString()
    };
    this.messages.push(botMsg);

    this.chatService.saveMessage(this.currentConversationId!, 'bot', content)
      .subscribe({ next: () => {}, error: err => console.error(err) });
  }

  private scrollToBottom(): void {
    try {
      this.chatContainer.nativeElement.scrollTop =
        this.chatContainer.nativeElement.scrollHeight;
    } catch {}
  }
}
