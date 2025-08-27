// src/app/components/settings/settings.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
})
export class SettingsComponent implements OnInit {
  firstName = '';
  lastName = '';
  email = '';
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';

  saving = false;
  message: { type: 'success' | 'error', text: string } | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<any>('http://localhost:8080/api/user/me').subscribe({
      next: u => {
        this.firstName = u.firstName ?? '';
        this.lastName = u.lastName ?? '';
        this.email = u.email ?? '';
      },
      error: e => console.error(e)
    });
  }

  saveSettings(): void {
    this.message = null;
    const wantsPw = !!(this.oldPassword || this.newPassword || this.confirmPassword);
    if (wantsPw) {
      if (!this.oldPassword || !this.newPassword) {
        this.message = { type: 'error', text: 'Renseigne ancien et nouveau mot de passe.' };
        return;
      }
      if (this.newPassword !== this.confirmPassword) {
        this.message = { type: 'error', text: 'La confirmation ne correspond pas.' };
        return;
      }
    }
    const dto: any = { firstName: this.firstName, lastName: this.lastName };
    if (wantsPw) { dto.oldPassword = this.oldPassword; dto.newPassword = this.newPassword; }

    this.saving = true;
    this.http.post('http://localhost:8080/api/user/settings', dto).subscribe({
      next: () => {
        this.message = { type: 'success', text: 'Paramètres enregistrés.' };
        this.oldPassword = this.newPassword = this.confirmPassword = '';
      },
      error: (err) => {
        const msg = typeof err?.error === 'string' && err.error ? err.error : 'Échec enregistrement (400).';
        this.message = { type: 'error', text: msg };
      },
      complete: () => this.saving = false
    });
  }
}
