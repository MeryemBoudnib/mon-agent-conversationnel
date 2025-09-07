import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../auth.service';

type VerifyResp = { valid: boolean };
type ViewState = 'forgot' | 'verifying' | 'invalid' | 'reset' | 'success';

@Component({
  standalone: true,
  selector: 'app-password-assist',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './password-assist.component.html',
  styleUrls: ['./password-assist.component.css'],
})
export class PasswordAssistComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);

  // ----- état -----
  view: ViewState = 'forgot';
  token: string | null = null;
  loading = false;
  error: string | null = null;

  // forgot
  email = '';
  noticeSent = false;
  countdown = 0;

  // reset
  password = '';
  confirm = '';
  showPw = false;
  showConfirm = false;

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');

    if (!this.token) {
      this.view = 'forgot';
      return;
    }

    // avec token -> on vérifie puis on bascule sur la page "reset" centrée
    this.view = 'verifying';
    this.auth.verifyResetToken(this.token).subscribe({
      next: (r: VerifyResp) => this.view = r?.valid ? 'reset' : 'invalid',
      error: () => this.view = 'invalid'
    });
  }

  // ----- Forgot -----
  submitForgot() {
    if (this.loading || !this.email.trim()) return;
    this.loading = true; this.error = null;

    this.auth.forgotPassword(this.email.trim()).subscribe({
      next: () => { this.noticeSent = true; this.loading = false; this.startTimer(); },
      error: () => { this.noticeSent = true; this.loading = false; this.startTimer(); }
    });
  }

  resend() {
    if (this.countdown > 0) return;
    this.submitForgot();
  }

  private startTimer() {
    this.countdown = 60;
    const id = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) clearInterval(id);
    }, 1000);
  }

  // ----- Reset -----
  strength(pw: string) {
    let s = 0;
    if (!pw) return 0;
    if (pw.length >= 8) s++;
    if (/[a-z]/.test(pw)) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s; // 0..5
  }

  submitReset() {
    if (!this.token || this.loading) return;
    this.error = null;

    if (!this.email.trim()) { this.error = 'Email requis.'; return; }
    if (this.password.length < 8) { this.error = 'Au moins 8 caractères.'; return; }
    if (this.password !== this.confirm) { this.error = 'Les mots de passe ne correspondent pas.'; return; }

    this.loading = true;
    this.auth.resetPassword(this.token, this.password, this.email.trim()).subscribe({
      next: () => { this.view = 'success'; this.loading = false; },
      error: (e) => { this.error = e?.error?.error || 'Erreur lors de la réinitialisation'; this.loading = false; }
    });
  }
}
