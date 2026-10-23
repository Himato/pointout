import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header>
      <strong>Pointout demo</strong>
      <nav aria-label="Main">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
          Dashboard
        </a>
        <a routerLink="/settings" routerLinkActive="active">Settings</a>
      </nav>
      <span class="tip">Press <kbd>Cmd/Ctrl+Shift+F</kbd> and click anything.</span>
    </header>
    <main>
      <router-outlet />
    </main>
  `,
  styles: `
    header {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      padding: 0.75rem 1.5rem;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
    }
    nav {
      display: flex;
      gap: 1rem;
    }
    a {
      color: var(--muted);
      text-decoration: none;
    }
    a.active {
      color: var(--accent);
      font-weight: 600;
    }
    .tip {
      margin-left: auto;
      color: var(--muted);
      font-size: 0.85rem;
    }
    main {
      max-width: 960px;
      margin: 0 auto;
      padding: 1.5rem;
    }
  `,
})
export class App {}
