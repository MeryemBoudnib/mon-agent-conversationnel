import { Component, ElementRef, OnDestroy, AfterViewInit, ViewChild } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth/auth.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

// GSAP
import { gsap } from 'gsap';
import { TextPlugin } from 'gsap/TextPlugin';
gsap.registerPlugin(TextPlugin);

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatSnackBarModule, // nécessaire pour afficher le snackbar
  ]
})
export class LoginComponent implements AfterViewInit, OnDestroy {
  email = '';
  password = '';
  loading = false;

  @ViewChild('typing', { static: true }) typing!: ElementRef<HTMLSpanElement>;
  @ViewChild('cursor', { static: true }) cursor!: ElementRef<HTMLSpanElement>;

  private tl?: gsap.core.Timeline;

  constructor(
    private auth: AuthService,
    private router: Router,
    private snack: MatSnackBar, // injection snackbar
  ) {}

  ngAfterViewInit(): void {
    const words = ['plats', 'cadeaux', 'week-end', 'jeux', 'posts LinkedIn'];
    const t = this.typing.nativeElement;
    const c = this.cursor.nativeElement;

    gsap.to(c, { opacity: 0.2, repeat: -1, yoyo: true, duration: 0.6, ease: 'power1.inOut' });

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5 });
    words.forEach((w) => {
      tl.to(t, { duration: 1, text: w, ease: 'none' })
        .to({}, { duration: 0.9 });
    });
    this.tl = tl;
  }

  ngOnDestroy(): void { this.tl?.kill(); }

  login(): void {
    if (this.loading) return;
    const email = this.email.trim();
    const password = this.password;
    if (!email || !password) return;

    this.loading = true;

    this.auth.login(email, password).subscribe({
      next: (res) => {
        this.loading = false;

        // ➜ IMPORTANT : si le backend renvoie active=false, on affiche l’alerte et on ne navigue pas
        if (res.active === false) {
          this.snack.open(
            'Votre compte est désactivé. Veuillez contacter l’administrateur.',
            'OK',
            { duration: 4000 }
          );
          return;
        }

        if (res.role === 'ADMIN') this.router.navigate(['/admin']);
        else this.router.navigate(['/chat']);
      },
      error: () => {
        this.loading = false;
        this.snack.open('Identifiants invalides', 'OK', { duration: 2000 });
      }
    });
  }
}
