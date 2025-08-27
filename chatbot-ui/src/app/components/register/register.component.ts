import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule, MatButtonModule]
})
export class RegisterComponent {
  firstName = '';
  lastName  = '';
  email     = '';
  password  = '';
  loading   = false;

  constructor(private authService: AuthService, private router: Router) {}

  register() {
    if (this.loading) return;

    const firstName = this.firstName.trim();
    const lastName  = this.lastName.trim();
    const email     = this.email.trim();
    const password  = this.password;

    if (!firstName || !lastName || !email || !password) {
      alert('Veuillez remplir tous les champs.');
      return;
    }

    this.loading = true;

    this.authService.register({ firstName, lastName, email, password }).subscribe({
      next: () => {
        this.loading = false;
        // On renvoie vers le login (tu peux auto-connecter si ton backend renvoie un token)
        this.router.navigate(['/login']);
      },
      error: () => {
        this.loading = false;
        alert("Échec de l'inscription");
      }
    });
  }
}
