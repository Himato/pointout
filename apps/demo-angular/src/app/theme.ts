import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';

export type ThemeName = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class Theme {
  private readonly html = inject(DOCUMENT).documentElement;
  readonly current = signal<ThemeName>('light');

  constructor() {
    effect(() => {
      const theme = this.current();
      this.html.style.colorScheme = theme;
      this.html.dataset['theme'] = theme;
    });
  }

  toggle(): void {
    this.current.update((theme) => (theme === 'light' ? 'dark' : 'light'));
  }
}
