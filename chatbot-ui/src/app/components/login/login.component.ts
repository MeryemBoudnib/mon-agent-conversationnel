import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule }  from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { RouterModule, Router } from '@angular/router';   // ← importer RouterModule

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    RouterModule  ,
    MatIconModule,    
    MatButtonModule  // ← ici !
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email = '';
  password = '';

  constructor(
    private http: HttpClient,
    private router: Router             // ← router injecté
  ) {}

  login() {
    const payload = { email: this.email, password: this.password };

    this.http.post<{ token: string }>(
        'http://localhost:8080/api/auth/login',
        payload
      )
      .subscribe({
        next: resp => {
          localStorage.setItem('access_token', resp.token);
          console.log('Token stocké :', resp.token);
          // 👉 décommenter / adapter la ligne suivante pour rediriger
          this.router.navigate(['/chat']);
        },
        error: () => {
          alert('Échec de la connexion, vérifiez vos identifiants');
        }
      });
  }
}
