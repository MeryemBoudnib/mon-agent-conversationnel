import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { ChatService, ChatReply, MessageMeta, WebResult, WebLogEntry } from '../../services/chat.service';
import { DocqaService } from '../../services/docqa.service';

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
  imports: [CommonModule, FormsModule, HttpClientModule],
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

  // 👇 WELCOME — uniquement UI (pas dans messages)
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
    private cdr: ChangeDetectorRef
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
        // Pas d’ID = nouvelle conv “vide” → overlay d’accueil
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
        this.updateWelcomeOverlay(); // 👈 WELCOME: affiche si conv réellement vide

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

  togglePress(): void { if (this.recording) this.stopDictation(); else this.startDictation(); }
  private startDictation(): void {
    if (!this.speechSupported) { alert('Dictée non supportée par ce navigateur.'); return; }
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

  async send(): Promise<void> {
    const msg = this.text.trim();
    if (!msg && this.draft.length === 0) return;

    this.showWelcomeOverlay = false; // 👈 WELCOME: on masque l’accueil dès que l’utilisateur envoie

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

  web(): void {
    const q = this.text.trim();
    if (!q) return;
    this.messages.push({ role: 'user', content: q, usedDocs: [] });
    this.text = '';
    this.webLoading = true;
    this.chat.externalAnswer(q, 5, this.conversationId, this.ns).subscribe({
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

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&quot;').replace(/'/g, '&#39;');
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

  // 👇 WELCOME — helpers
  private updateWelcomeOverlay(): void {
    this.showWelcomeOverlay = (this.messages.length === 0);
    this.cdr.detectChanges();
  }
  useSuggestion(s: string): void {
    this.text = s;
  }
}
