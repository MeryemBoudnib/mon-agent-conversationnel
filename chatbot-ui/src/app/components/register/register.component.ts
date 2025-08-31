import { Component, ElementRef, AfterViewInit, OnDestroy, ViewChild } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth/auth.service';

// GSAP
import { gsap } from 'gsap';
import { TextPlugin } from 'gsap/TextPlugin';
gsap.registerPlugin(TextPlugin);

@Component({
  selector: 'app-register',
  standalone: true,
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
  imports: [CommonModule, FormsModule, RouterModule]
})
export class RegisterComponent implements AfterViewInit, OnDestroy {
  firstName = '';
  lastName  = '';
  email     = '';
  password  = '';
  loading   = false;

  @ViewChild('typing', { static: true }) typing!: ElementRef<HTMLSpanElement>;
  @ViewChild('cursor', { static: true }) cursor!: ElementRef<HTMLSpanElement>;
  private tl?: gsap.core.Timeline;

  constructor(private auth: AuthService, private router: Router) {}

  ngAfterViewInit(): void {
    const phrases = [
      'rédiger un CV',
      'planifier un voyage',
      'préparer un exposé',
      'coder un prototype',
      'organiser un événement'
    ];
    const t = this.typing.nativeElement;
    const c = this.cursor.nativeElement;

    gsap.to(c, { opacity: .2, repeat: -1, yoyo: true, duration: .6 });

    const tl = gsap.timeline({ repeat: -1, repeatDelay: .5 });
    phrases.forEach(p => {
      tl.to(t, { duration: 1.1, text: p, ease: 'none' }).to({}, { duration: 0.9 });
    });
    this.tl = tl;
  }

  ngOnDestroy(): void { this.tl?.kill(); }

  register(): void {
    if (this.loading) return;
    const firstName = this.firstName.trim();
    const lastName  = this.lastName.trim();
    const email     = this.email.trim();
    const password  = this.password;

    if (!firstName || !lastName || !email || !password) { alert('Veuillez remplir tous les champs.'); return; }

    this.loading = true;
    this.auth.register({ firstName, lastName, email, password }).subscribe({
      next: () => { this.loading = false; this.router.navigate(['/login']); },
      error: () => { this.loading = false; alert("Échec de l'inscription"); }
    });
  }
}
