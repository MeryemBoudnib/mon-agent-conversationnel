import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DocqaService } from '../../../services/docqa.service';
import { AuthService } from '../../../auth/auth.service';

@Component({
  selector: 'app-chat-input',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatSnackBarModule],
  templateUrl: './chat-input.component.html',
  styleUrls: ['./chat-input.component.scss']
})
export class ChatInputComponent {
  @Output() send = new EventEmitter<string>();
  @Output() uploaded = new EventEmitter<{name:string; pages:number}>();

  text = '';
  uploading = false;

  constructor(private docqa: DocqaService, private sb: MatSnackBar, private auth: AuthService) {}

  onSend(): void {
    const t = this.text.trim();
    if (!t) return;
    this.send.emit(t);
    this.text = '';
  }

  triggerFile(input: HTMLInputElement): void { input.click(); }

  onFilePicked(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;

    this.uploading = true;
    const ns = this.auth.getNamespace();

    this.docqa.ingestFile(f, ns).subscribe({
      next: (res: any) => {
        this.sb.open('Fichier ajouté au contexte DocQA ✓', 'OK', { duration: 2000 });
        this.uploading = false;
        // informe le parent pour afficher le chip
        if (res?.doc) this.uploaded.emit({ name: res.doc, pages: res.pages ?? 0 });
      },
      error: () => {
        this.sb.open('Erreur upload DocQA', 'Fermer', { duration: 3000 });
        this.uploading = false;
      }
    });
    input.value = '';
  }
}
