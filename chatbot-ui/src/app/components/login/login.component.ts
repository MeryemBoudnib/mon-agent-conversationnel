import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { HttpClientModule } from '@angular/common/http';
import { AuthService } from '../../auth/auth.service';  // ✅ chemin vers le service

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    HttpClientModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email = '';
  password = '';
  loading = false;

  constructor(private auth: AuthService, private router: Router) {}

  // src/app/components/login/login.component.ts (extrait)
login() {
  if (!this.email || !this.password || this.loading) return;
  this.loading = true;

  this.auth.login(this.email, this.password).subscribe({
    next: () => {
      this.loading = false;
      const target = this.auth.isAdmin() ? '/admin' : '/chat';
      // ✅ on quitte /login directement, pas de nav vers '/' ni vers la même URL
      this.router.navigateByUrl(target, { replaceUrl: true });
    },
    error: () => {
      this.loading = false;
      alert('Échec de la connexion');
    }
  });
}

  }
