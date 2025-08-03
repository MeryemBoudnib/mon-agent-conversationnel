// CHEMIN : src/app/components/settings/settings.component.ts (VERSION FINALE CORRIGÉE)

import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";

interface User {
  firstName: string;
  lastName: string;
  email: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule, HttpClientModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatCardModule, MatIconModule
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class SettingsComponent implements OnInit {
  firstName = '';
  lastName = '';
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';
  email = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<User>('http://localhost:8080/api/user/me').subscribe(user => {
      this.firstName = user.firstName || '';
      this.lastName = user.lastName || '';
      this.email = user.email || '';
    });
  }

  saveSettings(): void {
    if (this.newPassword !== this.confirmPassword) {
      alert('❌ Les nouveaux mots de passe ne correspondent pas.');
      return;
    }

    const payload = {
      firstName: this.firstName,
      lastName: this.lastName,
      oldPassword: this.oldPassword,
      newPassword: this.newPassword
    };

    this.http.post('http://localhost:8080/api/user/settings', payload).subscribe({
      next: () => alert('✅ Paramètres sauvegardés avec succès.'),
      error: (err: any) => alert(`❌ Erreur lors de la sauvegarde. ${err.error?.message || 'Vérifiez votre ancien mot de passe.'}`)
    });
  }
}