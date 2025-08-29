import { Injectable } from '@angular/core';

type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private key = 'theme-mode';

  init() {
    const saved = (localStorage.getItem(this.key) as ThemeMode) || 'light';
    this.apply(saved);
  }

  toggle() {
    const next: ThemeMode = this.current() === 'dark' ? 'light' : 'dark';
    this.set(next);
  }

  set(mode: ThemeMode) {
    localStorage.setItem(this.key, mode);
    this.apply(mode);
  }

  current(): ThemeMode {
    return (localStorage.getItem(this.key) as ThemeMode) || 'light';
  }

  private apply(mode: ThemeMode) {
    const root = document.documentElement;
    if (mode === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
  }
}

