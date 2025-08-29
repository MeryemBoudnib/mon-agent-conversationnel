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

export interface ChatMessageDto {
  role: 'USER' | 'ASSISTANT' | 'user' | 'assistant' | string;
  content?: string;
  text?: string;
  message?: string;
  usedDocs?: string[];
}

// ---- Méta persistées (chips & usedDocs) ----
export type AttachmentMeta = { name: string; type?: string };
export interface MessageMeta {
  attachments?: AttachmentMeta[];
  usedDocs?: string[];
}

const PENDING_CONV_ID = 0; // avant d’avoir l’ID réel

@Injectable({ providedIn: 'root' })
export class ChatService {
  // adapte si tu utilises environment.api
  private readonly API = 'http://localhost:8080/api';

  readonly historyUpdated$ = new Subject<void>();

  // cache en mémoire, indexé par conversationId
  private metaByConv = new Map<number, Record<string, MessageMeta>>();

  constructor(private http: HttpClient) {}

  // ================= API =================
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

  getMessages(id: number): Observable<ChatMessageDto[]> {
    return this.http.get<ChatMessageDto[]>(`${this.API}/conversations/${id}/messages`);
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

  // ============== PERSISTENCE MÉTA (chips/usedDocs) ==============

  private storageKey(convId: number) {
    return `chat_meta_${convId}`;
  }

  private ensure(convId: number): Record<string, MessageMeta> {
    let map = this.metaByConv.get(convId);
    if (!map) {
      map = this.loadFromStorage(convId);
      this.metaByConv.set(convId, map);
    }
    return map;
  }

  private loadFromStorage(convId: number): Record<string, MessageMeta> {
    try {
      const raw = sessionStorage.getItem(this.storageKey(convId));
      return raw ? (JSON.parse(raw) as Record<string, MessageMeta>) : {};
    } catch {
      return {};
    }
  }

  private saveToStorage(convId: number, map: Record<string, MessageMeta>): void {
    try {
      sessionStorage.setItem(this.storageKey(convId), JSON.stringify(map));
    } catch {
      // storage plein/désactivé → on ignore
    }
  }

  /** Ajoute/merge des métadonnées pour un message (clé = role|content) */
  setMeta(convId: number | null, key: string, meta: MessageMeta): void {
    const id = convId ?? PENDING_CONV_ID;
    const map = this.ensure(id);
    map[key] = { ...map[key], ...meta };
    this.saveToStorage(id, map);
  }

  /** Récupère les métadonnées d’un message (clé = role|content) */
  getMeta(convId: number, key: string): MessageMeta | undefined {
    const map = this.ensure(convId);
    return map[key];
  }

  /** Récupère toutes les métadonnées connues pour une conversation */
  getAllMeta(convId: number): Record<string, MessageMeta> {
    return this.ensure(convId);
  }

  /** Après création d’une nouvelle conv : migre les méta du bucket “pending” (0) vers l’ID réel */
  migratePendingTo(newConvId: number): void {
    if (!newConvId || newConvId <= 0) return;

    const pending = this.ensure(PENDING_CONV_ID);
    if (!Object.keys(pending).length) return;

    const target = this.ensure(newConvId);
    for (const k of Object.keys(pending)) {
      target[k] = { ...target[k], ...pending[k] };
    }
    this.metaByConv.set(newConvId, target);
    this.saveToStorage(newConvId, target);

    // reset pending
    this.metaByConv.set(PENDING_CONV_ID, {});
    this.saveToStorage(PENDING_CONV_ID, {});
  }

  /** Supprime tout (utile si on “Tout supprimer”) */
  clearForConversation(convId: number): void {
    this.metaByConv.delete(convId);
    sessionStorage.removeItem(this.storageKey(convId));
  }
}
