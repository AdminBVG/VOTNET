import { Injectable } from '@angular/core';

type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private key = 'theme-mode';

  init() {
    const raw = localStorage.getItem(this.key);
    let saved: ThemeMode = 'light';
    if (raw) {
      try { saved = JSON.parse(raw) as ThemeMode; } catch { saved = raw as ThemeMode; }
    }
    this.apply(saved);
  }

  toggle() {
    const next: ThemeMode = this.current() === 'dark' ? 'light' : 'dark';
    this.set(next);
  }

  set(mode: ThemeMode) {
    localStorage.setItem(this.key, JSON.stringify(mode));
    this.apply(mode);
  }

  current(): ThemeMode {
    const raw = localStorage.getItem(this.key);
    if (!raw) return 'light';
    try { return JSON.parse(raw) as ThemeMode; } catch { return raw as ThemeMode; }
  }

  private apply(mode: ThemeMode) {
    const root = document.documentElement;
    if (mode === 'dark') {
      root.setAttribute('data-theme', 'dark');
      root.classList.add('dark');
    } else {
      root.removeAttribute('data-theme');
      root.classList.remove('dark');
    }
  }
}


