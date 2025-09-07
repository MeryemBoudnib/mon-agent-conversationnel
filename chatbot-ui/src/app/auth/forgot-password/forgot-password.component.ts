import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../auth.service';

type ForgotResp = { message: string; resetUrl?: string };

@Component({
  standalone: true,
  selector: 'app-forgot-password',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent {
  email = '';
  loading = false;
  sent = false;
  countdown = 0;
  error: string | null = null;

  constructor(private auth: AuthService, private router: Router) {}

  submit() {
    if (this.loading || !this.email.trim()) return;
    this.loading = true; 
    this.error = null;

    this.auth.forgotPassword(this.email.trim()).subscribe({
      next: (res: ForgotResp) => {
        this.sent = true;
        this.loading = false;

        // DEV shortcut: si l’API renvoie resetUrl, on navigue directement
        if (res?.resetUrl) {
          try {
            const url = new URL(res.resetUrl, window.location.origin);
            const token = url.searchParams.get('token') || '';
            this.router.navigate(['/reset-password'], { queryParams: { token } });
          } catch {
            this.startTimer();
          }
        } else {
          // PROD: on affiche "Lien envoyé" + timer
          this.startTimer();
        }
      },
      error: () => {
        // Anti-énumération : même UX que si OK
        this.sent = true;
        this.loading = false;
        this.startTimer();
      }
    });
  }

  resend() {
    this.sent = false;
    this.countdown = 0;
  }

  private startTimer() {
    this.countdown = 60;
    const id = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) clearInterval(id);
    }, 1000);
  }
}
