import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';

export interface Conversation {
  id: number;
  title: string;
  date?: string | number | null;
}

export interface ChatReply {
  reply: string;
  conversationId: number;
  usedDocs?: string[];
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly API = 'http://localhost:8080/api';
  readonly historyUpdated$ = new Subject<void>();

  constructor(private http: HttpClient) {}

  handleChat(
    message: string,
    opts?: { doc?: string | null; docs?: string[]; conversationId?: number | null }
  ): Observable<ChatReply> {
    const body: any = { message };
    if (opts?.doc) body.doc = opts.doc;
    if (opts?.docs?.length) body.docs = opts.docs;
    if (opts?.conversationId != null) body.conversationId = opts.conversationId;
    return this.http.post<ChatReply>(`${this.API}/chat`, body);
  }

  getHistory(): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${this.API}/conversations/history`);
  }
  deleteConversation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/conversations/${id}`);
  }
  deleteAllConversations(): Observable<void> {
    return this.http.delete<void>(`${this.API}/conversations`);
  }
  notifyHistoryUpdate(): void {
    this.historyUpdated$.next();
  }
}
