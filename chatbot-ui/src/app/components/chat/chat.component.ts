import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';

import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ChatService, ChatReply, MessageMeta, WebResult, WebLogEntry } from '../../services/chat.service';
import { DocqaService } from '../../services/docqa.service';
import { ConfirmService } from '../../shared/confirm-dialog/confirm.service';

type Attachment = { file?: File; name: string; type?: string };
type Msg = {
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
  usedDocs: string[];
  citations?: WebResult[];
};

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, MatSnackBarModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css'],
})
export class ChatComponent implements OnInit, OnDestroy {
  // UI
  text = '';
  messages: Msg[] = [];
  draft: Attachment[] = [];

  // convo
  ns = 'guest';
  conversationId: number | null = null;
  private hadIdInUrl = false;
  private routeSub?: Subscription;
  private skipNextLoad = false;

  // STT
  speechLang = 'fr-FR';
  speechSupported = false;
  recording = false;
  private sr?: any;
  private srFinal = '';
  private srInterim = '';

  // Web
  webLoading = false;

  // WELCOME — uniquement UI
  showWelcomeOverlay = false;
  welcomeText = 'Bonjour ! Comment puis-je vous assister aujourd’hui ?';
  welcomeSuggestions: string[] = [
    'Résume ce PDF joint',
    'Explique ce code',
    'Génère un plan de cours',
    'Rédige un email de relance',
    'Donne-moi 3 idées de post'
  ];

  constructor(
    private chat: ChatService,
    private docqa: DocqaService,
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private snack: MatSnackBar,
    private confirm: ConfirmService,
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(pm => {
      const idParam = pm.get('id') ?? pm.get('conversationId');
      const id = idParam ? Number(idParam) : NaN;

      if (!Number.isNaN(id)) {
        this.hadIdInUrl = true;
        this.conversationId = id;
        if (this.skipNextLoad) { this.skipNextLoad = false; return; }
        this.loadConversation(id);
      } else {
        this.updateWelcomeOverlay();
      }
    });

    this.ns = this.resolveNs();
    this.speechSupported = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.stopDictation();
  }

  private resolveNs(): string {
    const email = (localStorage.getItem('email') || '').trim();
    return email ? email.toLowerCase() : 'guest';
  }

  private keyOf(role: 'user' | 'assistant', content: string): string {
    return `${role}|${(content || '').trim()}`;
  }

  private loadConversation(id: number): void {
    this.chat.getMessages(id).subscribe({
      next: (msgs) => {
        const mapped: Msg[] = (msgs ?? []).map((m: any) => ({
          role: (m.role === 'USER' || m.role === 'user') ? 'user' : 'assistant',
          content: m.content ?? m.text ?? m.message ?? '',
          usedDocs: m.usedDocs ?? [],
        }));

        const metaAll = this.chat.getAllMeta(id);
        for (let i = 0; i < mapped.length; i++) {
          const k = this.keyOf(mapped[i].role, mapped[i].content);
          const meta = metaAll[k];
          if (meta) {
            if (meta.attachments?.length) mapped[i].attachments = meta.attachments as Attachment[];
            if (meta.usedDocs?.length) mapped[i].usedDocs = meta.usedDocs;
          }
        }

        this.messages = mapped;
        this.updateWelcomeOverlay();

        this.chat.fetchWebLog(this.conversationId, this.ns).subscribe({
          next: (logs: WebLogEntry[]) => {
            const asMsgs: Msg[] = (logs || []).map(l => ({
              role: l.role,
              content: l.content,
              usedDocs: [],
              citations: l.citations || []
            }));
            this.messages = [...this.messages, ...asMsgs];
            this.updateWelcomeOverlay();
          },
          error: () => {}
        });
      },
      error: () => { this.messages = []; this.updateWelcomeOverlay(); },
    });
  }

  // ---------- pièces jointes
  onPickFiles(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    for (const f of files) this.draft.push({ file: f, name: f.name, type: f.type });
    input.value = '';
  }
  removeDraft(i: number): void { this.draft.splice(i, 1); }

  private async ingestAttachments(attachments: Attachment[]): Promise<string[]> {
    const names: string[] = [];
    for (const att of attachments) {
      await new Promise<void>((ok) => {
        this.docqa.ingestFile(att.file as File, this.ns, this.conversationId ?? undefined)
          .subscribe({ next: () => { names.push(att.name); ok(); }, error: () => ok() });
      });
    }
    return names;
  }

  // ---------- dictée
  togglePress(): void { if (this.recording) this.stopDictation(); else this.startDictation(); }
  private startDictation(): void {
    if (!this.speechSupported) {
      this.snack.open('Dictée non supportée par ce navigateur.', 'OK', { duration: 2500 });
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.sr = new SR(); this.sr.lang = this.speechLang; this.sr.continuous = true; this.sr.interimResults = true;
    this.srFinal = ''; this.srInterim = ''; this.recording = true;
    this.sr.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) this.srFinal += r[0].transcript; else interim += r[0].transcript;
      }
      this.srInterim = interim; this.text = (this.srFinal + ' ' + this.srInterim).trim(); this.cdr.detectChanges();
    };
    this.sr.onend = () => { this.recording = false; this.sr = undefined; this.srInterim = ''; this.text = (this.srFinal || this.text).trim(); this.cdr.detectChanges(); };
    try { this.sr.start(); } catch {}
  }
  private stopDictation(): void { try { this.sr?.stop(); } catch {} this.recording = false; this.srInterim = ''; }

  // ---------- envoi
  async send(): Promise<void> {
    const msg = this.text.trim();
    if (!msg && this.draft.length === 0) return;

    this.showWelcomeOverlay = false;

    const attachedNow = [...this.draft];
    const docs = await this.ingestAttachments(attachedNow);
    this.messages.push({ role: 'user', content: msg, attachments: attachedNow, usedDocs: [] });
    const attachmentsMeta = attachedNow.map(a => ({ name: a.name, type: a.type })) as MessageMeta['attachments'];
    this.chat.setMeta(this.conversationId, this.keyOf('user', msg), { attachments: attachmentsMeta });
    this.text = ''; this.draft = [];

    this.chat.handleChat(msg, { docs, conversationId: this.conversationId }).subscribe({
      next: (res: ChatReply) => {
        if (this.conversationId == null && res?.conversationId != null) {
          this.conversationId = res.conversationId;
          this.chat.migratePendingTo(this.conversationId);
          this.chat.migrateWebLogToConv(this.conversationId, this.ns).subscribe({ next: () => {}, error: () => {} });
          this.skipNextLoad = true;
          if (!this.hadIdInUrl) {
            this.router.navigate(['/chat', this.conversationId], { replaceUrl: true });
          }
          this.chat.notifyHistoryUpdate();
        }

        const reply = res?.reply ?? '(réponse vide)';
        const used = res?.usedDocs || [];
        this.messages.push({ role: 'assistant', content: reply, usedDocs: used });
        this.chat.setMeta(this.conversationId, this.keyOf('assistant', reply), { usedDocs: used });
        this.updateWelcomeOverlay();
      },
      error: () => {
        this.messages.push({ role: 'assistant', content: 'Erreur réseau.', usedDocs: [] });
        this.updateWelcomeOverlay();
      },
    });
  }

  // ---------- recherche web (HYBRIDE si docs présents)
  async web(): Promise<void> {
    const q = this.text.trim();
    if (!q && this.draft.length === 0) return;

    // 1) ingérer un éventuel brouillon et récupérer ses noms de docs
    const attachedNow = [...this.draft];
    const hasDraft = attachedNow.length > 0;
    let docsFromDraft: string[] = [];
    if (hasDraft) {
      docsFromDraft = await this.ingestAttachments(attachedNow);
    }

    // 2) récupérer les docs déjà utilisés dans la conversation
    const docsFromHistory = Array.from(
      new Set((this.messages || []).flatMap(m => m.usedDocs || []).filter(Boolean))
    );

    // 3) liste finale
    const docs = Array.from(new Set([...(docsFromDraft || []), ...(docsFromHistory || [])]));

    // push message utilisateur (avec chips éventuels)
    this.messages.push({
      role: 'user',
      content: q || 'De quoi parle ce fichier ?',
      attachments: hasDraft ? attachedNow : undefined,
      usedDocs: []
    });
    if (hasDraft) {
      const attachmentsMeta = attachedNow.map(a => ({ name: a.name, type: a.type })) as MessageMeta['attachments'];
      this.chat.setMeta(this.conversationId, this.keyOf('user', q || 'De quoi parle ce fichier ?'), { attachments: attachmentsMeta });
    }

    // reset UI
    this.text = '';
    this.draft = [];
    this.webLoading = true;

    // appel — hybrid si des docs existent
    this.chat.externalAnswer(q || 'De quoi parle ce fichier ?', 5, this.conversationId, this.ns, {
      hybrid: docs.length > 0,
      docs
    }).subscribe({
      next: (res) => {
        const reply = res?.reply || '(réponse vide)';
        const citations = res?.citations || [];
        this.messages.push({ role: 'assistant', content: reply, usedDocs: [], citations });
        this.webLoading = false;
        this.updateWelcomeOverlay();
      },
      error: () => {
        this.messages.push({ role: 'assistant', content: 'Erreur recherche web.', usedDocs: [] });
        this.webLoading = false;
        this.updateWelcomeOverlay();
      }
    });
  }

  open(url: string): void {
    if (!url) return;
    window.open(url, '_blank', 'noopener');
  }

  // ---------- rendu markdown light
  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  private renderInline(s: string): string {
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[\s(])\*(?!\s)([^*]+?)\*(?=[\s).,;!?]|$)/g, '$1<em>$2</em>');
    return s;
  }
  private mdToHtml(md: string): string {
    const sourceSplit = md.split(/\n\s*Sources:/i);
    const mainContent = sourceSplit[0];

    const lines = this.escapeHtml(mainContent).split(/\r?\n/);
    const out: string[] = [];
    let inList = false;
    const flushList = () => { if (inList) { out.push('</ul>'); inList = false; } };

    for (const raw of lines) {
      const m = raw.match(/^\s*[*-]\s+(.*)$/);
      if (m) {
        if (!inList) { out.push('<ul>'); inList = true; }
        out.push(`<li>${this.renderInline(m[1])}</li>`);
        continue;
      }
      if (!raw.trim()) {
        flushList();
        out.push('<p style="margin:.35rem 0"></p>');
        continue;
      }
      flushList();
      out.push(`<p>${this.renderInline(raw)}</p>`);
    }
    flushList();
    return out.join('');
  }
  asHtml(content: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.mdToHtml(content || ''));
  }

  // ---------- welcome
  private updateWelcomeOverlay(): void {
    this.showWelcomeOverlay = (this.messages.length === 0);
    this.cdr.detectChanges();
  }
  useSuggestion(s: string): void { this.text = s; }

  // ---------- confirmations pro (modales Material)
  onDeleteConversationRequested(): void {
    if (!this.conversationId) return;
    this.confirm.open({
      title: 'Supprimer la conversation',
      message: 'Voulez-vous supprimer définitivement cette conversation ?',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      tone: 'danger'
    }).subscribe((ok: boolean) => {
      if (!ok) return;
      this.chat.deleteConversation(this.conversationId!).subscribe({
        next: () => {
          this.messages = [];
          this.conversationId = null;
          this.showWelcomeOverlay = true;
          this.router.navigate(['/chat']);
          this.chat.notifyHistoryUpdate();
          this.snack.open('Conversation supprimée', 'OK', { duration: 1500 });
        },
        error: () => this.snack.open('Échec de suppression.', 'OK', { duration: 2500 })
      });
    });
  }

  onDeleteAllRequested(): void {
    this.confirm.open({
      title: 'Purger l’historique',
      message: 'Supprimer tout  ?',
      confirmText: 'Tout supprimer',
      cancelText: 'Annuler',
      tone: 'danger'
    }).subscribe((ok: boolean) => {
      if (!ok) return;

      const svc: any = this.chat as any;
      if (typeof svc.deleteAll === 'function') {
        svc.deleteAll(this.ns).subscribe({
          next: () => {
            this.messages = [];
            this.conversationId = null;
            this.showWelcomeOverlay = true;
            this.router.navigate(['/chat'], { replaceUrl: true });
            this.chat.notifyHistoryUpdate();
            this.snack.open('Historique purgé', 'OK', { duration: 1500 });
          },
          error: () => this.snack.open('Échec de la purge.', 'OK', { duration: 2500 })
        });
        return;
      }

      // Fallback UI si pas d’API
      this.messages = [];
      this.conversationId = null;
      this.showWelcomeOverlay = true;
      this.router.navigate(['/chat'], { replaceUrl: true });
      this.chat.notifyHistoryUpdate();
      this.snack.open('Historique réinitialisé localement', 'OK', { duration: 1500 });
    });
  }
}
