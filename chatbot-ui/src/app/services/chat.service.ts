// CHEMIN : src/app/services/chat.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
export interface Message {
  role: 'user' | 'bot';
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: number;
  title: string;
  date?: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly BASE = 'http://localhost:8080/api/conversations';
  private readonly CHAT = 'http://localhost:8080/api/chat';

  constructor(private http: HttpClient) {}

  createConversation(payload: { title: string; userMessage: string; botReply: string }): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.BASE}/create`, payload);
  }

  getHistory(): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${this.BASE}/history`);
  }

  deleteConversation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.BASE}/${id}`);
  }

  deleteAllConversations(): Observable<void> {
    return this.http.delete<void>(`${this.BASE}`);
  }

  saveMessage(id: number, role: 'user' | 'bot', content: string): Observable<void> {
    return this.http.post<void>(`${this.BASE}/${id}/message`, { role, content });
  }

  getConversationMessages(id: number): Observable<Message[]> {
    return this.http.get<Message[]>(`${this.BASE}/${id}/messages`);
  }

  askAI(message: string): Observable<{ reply: string }> {
    return this.http.post<{ reply: string }>(`${this.CHAT}/ask`, { message });
  }
private historyUpdatedSource = new Subject<void>();
historyUpdated$ = this.historyUpdatedSource.asObservable();

notifyHistoryUpdate(): void {
  this.historyUpdatedSource.next();}
  handleChat(message: string): Observable<{ reply: string }> {
    return this.http.post<{ reply: string }>(`${this.CHAT}/handle`, { message });
  }
}