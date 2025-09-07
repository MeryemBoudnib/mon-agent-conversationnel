import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// --------- Types API existants ----------
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

// ---- Web (citations) ----
export interface WebResult {
  title?: string;
  url: string;
  snippet?: string;
}
export interface WebLogEntry {
  ts: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: WebResult[];
}

const PENDING_CONV_ID = 0; // avant d’avoir l’ID réel

@Injectable({ providedIn: 'root' })
export class ChatService {
  /** Base API: supporte apiUrl/aiUrl ET api/ai, et force le suffixe /api */
  private readonly API = (() => {
    const e = environment as any;
    const base = e.apiUrl ?? e.api ?? 'http://localhost:8080/api';
    return String(base).endsWith('/api') ? String(base) : `${String(base).replace(/\/+$/, '')}/api`;
  })();

  /** Base IA: supporte aiUrl ET ai */
  private readonly IA = (() => {
    const e = environment as any;
    const base = e.aiUrl ?? e.ai ?? 'http://localhost:5000';
    return String(base).replace(/\/+$/, '');
  })();

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

  /** ❗️Ne purge que MES conversations */
  deleteAllMine(): Observable<void> {
    return this.http.delete<void>(`${this.API}/conversations/me`);
  }

  notifyHistoryUpdate(): void {
    this.historyUpdated$.next();
  }

  // ============== MCP Web search (pour le bouton Web) ==============
  /**
   * externalAnswer — peut fonctionner en mode "hybride" si on passe { hybrid: true, docs: [...] }.
   * Le backend ajoutera alors le sujet du/des doc(s) à la requête web et journalisera /web-log.
   */
  externalAnswer(
    query: string,
    k = 5,
    conversationId?: number | null,
    ns?: string,
    options?: { hybrid?: boolean; docs?: string[] }
  ): Observable<{ reply: string; citations: WebResult[] }> {
    const body: any = {
      action: 'external_answer',
      parameters: { query, k }
    };
    if (options?.hybrid) {
      body.parameters.hybrid = true;
    }
    if (options?.docs?.length) {
      body.parameters.docs = options.docs;
    }
    if (conversationId != null) body.conversationId = conversationId;
    return this.http
      .post<{ version: string; id: string; status: string; data: { reply: string; citations: WebResult[] } }>(
        `${this.IA}/mcp/execute`,
        body,
        { headers: ns ? { 'X-Doc-NS': ns } : undefined }
      )
      .pipe(map(res => (res?.data ?? { reply: 'Aucune réponse', citations: [] })));
  }

  fetchWebLog(conversationId?: number | null, ns?: string) {
    const params: any = {};
    if (conversationId != null) params.conv = String(conversationId);
    return this.http.get<WebLogEntry[]>(`${this.IA}/web-log`, {
      params,
      headers: ns ? { 'X-Doc-NS': ns } : undefined
    });
  }

  migrateWebLogToConv(newConvId: number, ns?: string) {
    return this.http.post(`${this.IA}/web-log/migrate`, { toConv: newConvId }, {
      headers: ns ? { 'X-Doc-NS': ns } : undefined
    });
  }
  /** Met à jour une conversation (ex: titre) */
  updateConversation(
    id: number,
    patch: Partial<{ title: string; date?: string | number | null }>
  ) {
    // Utilise PATCH; si ton backend attend PUT, remplace par this.http.put<Conversation>(...)
    return this.http.patch<Conversation>(`${this.API}/conversations/${id}`, patch);
  }

  // ============== PERSISTENCE MÉTA (chips/usedDocs) ==============
  private storageKey(convId: number) { return `chat_meta_${convId}`; }

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

  /** Récupère toutes les métadonnées connues pour une conversation */
  getAllMeta(convId: number): Record<string, MessageMeta> {
    return this.ensure(convId);
  }

  /** Supprime tout (utile si on “Tout supprimer”) */
  clearForConversation(convId: number): void {
    this.metaByConv.delete(convId);
    sessionStorage.removeItem(this.storageKey(convId));
  }

  /** Après création d’une nouvelle conv : migre les méta du bucket “pending” (0) vers l’ID réel */
  migratePendingTo(newConvId: number): void {
    if (!newConvId || newConvId <= 0) return;

    // migrate meta
    const pending = this.ensure(PENDING_CONV_ID);
    if (Object.keys(pending).length) {
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
  }
}
