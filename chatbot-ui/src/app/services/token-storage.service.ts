import { Injectable } from '@angular/core';

const KEY = 'access_token'; // <— UN SEUL NOM PARTOUT

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  get(): string | null { return localStorage.getItem(KEY); }
  set(token: string) { localStorage.setItem(KEY, token); }
  clear() { localStorage.removeItem(KEY); }
  isLoggedIn() { return !!this.get(); }
}
