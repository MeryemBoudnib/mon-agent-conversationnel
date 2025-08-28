import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../services/chat.service';
import { DocqaService } from '../../services/docqa.service';

type Attachment = { file: File; name: string; type: string };
type Msg = {
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
  usedDocs: string[];
};

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css'],
})
export class ChatComponent implements OnInit {
  text = '';
  messages: Msg[] = [];

  ns = 'guest';
  conversationId: number | null = null;

  draft: Attachment[] = [];
  dragging = false;

  constructor(private chat: ChatService, private docqa: DocqaService) {}

  ngOnInit(): void {
    this.ns = this.resolveNs();
  }

  private resolveNs(): string {
    const email = (localStorage.getItem('email') || '').trim();
    return email ? email.toLowerCase() : 'guest';
  }

  onFilePicked(ev: Event): void {
    const input = ev.target as HTMLInputElement | null;
    const files = input?.files ?? null;
    this.addFiles(files);
    if (input) input.value = '';
  }

  onDragOver(ev: DragEvent): void { ev.preventDefault(); this.dragging = true; }
  onDragLeave(ev: DragEvent): void { ev.preventDefault(); this.dragging = false; }
  onDrop(ev: DragEvent): void {
    ev.preventDefault(); this.dragging = false;
    const files = ev.dataTransfer?.files ?? null;
    this.addFiles(files);
  }

  private addFiles(fileList: FileList | null): void {
    if (!fileList || fileList.length === 0) return;
    const existingKeys = new Set(this.draft.map(d => d.name + '|' + d.file.size));
    Array.from(fileList).forEach(f => {
      const key = f.name + '|' + f.size;
      if (!existingKeys.has(key)) {
        this.draft.push({ file: f, name: f.name, type: f.type || 'application/octet-stream' });
        existingKeys.add(key);
      }
    });
  }

  removeDraft(i: number): void { this.draft.splice(i, 1); }

  private async ingestAttachments(attachments: Attachment[]): Promise<string[]> {
    const names: string[] = [];
    for (const att of attachments) {
      await new Promise<void>((ok) => {
        this.docqa.ingestFile(att.file, this.ns, this.conversationId).subscribe({
          next: () => { names.push(att.name); ok(); },
          error: () => ok(),
        });
      });
    }
    return names;
  }

  async send(): Promise<void> {
    const msg = this.text.trim();
    if (!msg && this.draft.length === 0) return;

    const attachedNow = [...this.draft];

    // 1) ingérer avant d’appeler le chat
    const docs = await this.ingestAttachments(attachedNow);

    // 2) afficher le message user
    this.messages.push({ role: 'user', content: msg, attachments: attachedNow, usedDocs: [] });
    this.text = '';
    this.draft = [];

    // 3) requête chat avec docs + convId
    this.chat.handleChat(msg, { docs, conversationId: this.conversationId }).subscribe({
      next: (res) => {
        if (this.conversationId == null && res?.conversationId != null) {
          this.conversationId = res.conversationId;
        }
        this.messages.push({
          role: 'assistant',
          content: res?.reply ?? '(réponse vide)',
          usedDocs: res?.usedDocs || [],
        });
      },
      error: () => this.messages.push({ role: 'assistant', content: 'Erreur réseau.', usedDocs: [] })
    });
  }
}
