import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatListModule } from '@angular/material/list';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { DocqaService, DocqaHit } from '../../services/docqa.service';

@Component({
  selector: 'app-docqa-uploader',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule, MatProgressBarModule,
    MatListModule, MatInputModule, MatSnackBarModule,
    MatTooltipModule, MatChipsModule, MatCardModule
  ],
  templateUrl: './docqa-uploader.component.html',
  styleUrls: ['./docqa-uploader.component.scss']
})
export class DocqaUploaderComponent {
  // UI state
  isUploading = signal(false);
  isSearching  = signal(false);
  query = signal('');
  results = signal<DocqaHit[]>([]);
  selectedFile = signal<File | null>(null);

  // Info health
  healthInfo = signal<any>(null);

  // accepte .pdf .txt .csv
  accept = '.pdf,.txt,.csv';

  constructor(private docqa: DocqaService, private sb: MatSnackBar) {
    this.docqa.health().subscribe(h => this.healthInfo.set(h));
  }

  pickFile(input: HTMLInputElement) {
    input.click();
  }

  onFileInput(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0] || null;
    if (!f) return;
    this.selectedFile.set(f);
  }

  uploadSelected() {
    const f = this.selectedFile();
    if (!f) return;
    this.isUploading.set(true);
    this.docqa.ingestFile(f).subscribe({
      next: () => {
        this.isUploading.set(false);
        this.sb.open('Document ingéré avec succès', 'OK', { duration: 2000 });
        this.selectedFile.set(null);
      },
      error: (err) => {
        this.isUploading.set(false);
        this.sb.open('Erreur ingestion: ' + (err?.status || ''), 'Fermer', { duration: 3000 });
      }
    });
  }

  search() {
    const q = this.query().trim();
    if (!q) return;
    this.isSearching.set(true);
    this.docqa.search(q, 5).subscribe({
      next: hits => { this.results.set(hits); this.isSearching.set(false); },
      error: err => { this.isSearching.set(false); this.sb.open('Erreur search', 'Fermer', { duration: 3000 }); }
    });
  }

  clearResults() {
    this.results.set([]);
  }

  // Drag & drop
  onDrop(ev: DragEvent) {
    ev.preventDefault();
    const f = ev.dataTransfer?.files?.[0];
    if (f) this.selectedFile.set(f);
  }
  onDragOver(ev: DragEvent) { ev.preventDefault(); }
}
