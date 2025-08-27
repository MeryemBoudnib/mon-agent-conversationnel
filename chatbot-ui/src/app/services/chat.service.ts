// CHEMIN : src/app/services/chat.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Message {
  role: 'user' | 'bot';
  content: string;
  timestamp?: string;
}

export interface Conversation {
  id: number;
  title: string;
  date?: string;
  messages?: Message[];
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly API = 'http://localhost:8080/api';

  // ---- Stream pour prévenir la sidebar/historique d’un refresh
  private historyUpdatedSubject = new BehaviorSubject<void>(undefined);
  historyUpdated$ = this.historyUpdatedSubject.asObservable();
  notifyHistoryUpdate(): void { this.historyUpdatedSubject.next(); }

  constructor(private http: HttpClient) {}

  /* =========================
     HISTORIQUE (⚠️ /api/history)
  ========================== */
getHistory(): Observable<Conversation[]> {
  return this.http.get<Conversation[]>(`${this.API}/conversations/history`);
}


  /* =========================
     CONVERSATIONS
  ========================== */
  createConversation(): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.API}/conversations/create`, {});
  }

  deleteConversation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/conversations/${id}`);
  }

  deleteAllConversations(): Observable<void> {
    return this.http.delete<void>(`${this.API}/conversations`);
  }

  /* =========================
     MESSAGES
  ========================== */
  getConversationMessages(convId: number): Observable<Message[]> {
    return this.http.get<Message[]>(`${this.API}/conversations/${convId}/messages`);
  }
// chat.service.ts
saveMessage(convId: number, role: 'user' | 'bot', content: string): Observable<void> {
  return this.http.post<void>(`${this.API}/conversations/${convId}/messages`, { role, content });
}


  /* =========================
     BOT
  ========================== */
  handleChat(message: string): Observable<{ reply: string }> {
    return this.http.post<{ reply: string }>(`${this.API}/chat/handle`, { message });
  }

  askAI(message: string): Observable<{ reply: string }> {
    return this.http.post<{ reply: string }>(`${this.API}/chat/ask`, { message });
  }
}
