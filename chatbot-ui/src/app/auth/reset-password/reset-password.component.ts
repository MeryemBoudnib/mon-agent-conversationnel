import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../auth.service';

type ViewState = 'reset' | 'verifying' | 'invalid' | 'success';

@Component({
  standalone: true,
  selector: 'app-reset-password',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css'],
})
export class ResetPasswordComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);

  // États
  view: ViewState = 'reset';
  devMode = false;                 // pas de token → mode local
  token: string | null = null;

  // Form
  email = '';
  password = '';
  confirm = '';
  showPw = false;
  showConfirm = false;

  loading = false;
  error: string | null = null;

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');

    if (this.token) {
      this.view = 'verifying';
      this.auth.verifyResetToken(this.token).subscribe({
        next: r => (this.view = r?.valid ? 'reset' : 'invalid'),
        error: () => (this.view = 'invalid'),
      });
    } else {
      this.devMode = true;
      this.view = 'reset';
    }
  }

  strength(pw: string): number {
    let s = 0;
    if (!pw) return 0;
    if (pw.length >= 8) s++;
    if (/[a-z]/.test(pw)) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s; // 0..5
  }

  submitReset(): void {
    if (this.loading) return;
    this.error = null;

    const email = (this.email || '').trim();
    if (!email) { this.error = 'Email requis.'; return; }
    if ((this.password || '').length < 8) { this.error = 'Au moins 8 caractères.'; return; }
    if (this.password !== this.confirm) { this.error = 'Les mots de passe ne correspondent pas.'; return; }

    this.loading = true;

    const done = () => { this.view = 'success'; this.loading = false; };
    const fail = (e: any) => {
      this.error = e?.error?.error || e?.error?.message || 'Erreur lors de la réinitialisation';
      this.loading = false;
    };

    if (this.devMode) {
      this.auth.resetPasswordDev(email, this.password).subscribe({ next: done, error: fail });
    } else {
      if (!this.token) { this.error = 'Lien invalide.'; this.loading = false; return; }
      this.auth.resetPassword(this.token!, this.password, email).subscribe({ next: done, error: fail });
    }
  }
}
