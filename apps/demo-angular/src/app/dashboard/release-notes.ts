import { Component, ViewEncapsulation, signal } from '@angular/core';

/** Lives in a real shadow root, so Pointout has to look through it. */
@Component({
  selector: 'app-release-notes',
  encapsulation: ViewEncapsulation.ShadowDom,
  template: `
    <h2>What shipped</h2>
    <ul>
      <li>Faster deploy previews</li>
      <li>Dark mode for the settings page</li>
      <li>Fewer flaky tests, allegedly</li>
    </ul>
    <button type="button" (click)="read.set(!read())">
      {{ read() ? 'Read, nice' : 'Mark as read' }}
    </button>
  `,
  styles: `
    :host {
      display: block;
      padding: 1.25rem;
      border: 1px dashed var(--accent);
      border-radius: var(--radius);
      background: var(--surface);
      color: var(--text);
    }
    h2 {
      margin: 0 0 0.5rem;
      font-size: 1.1rem;
    }
    ul {
      margin: 0 0 1rem;
      padding-left: 1.2rem;
    }
    button {
      font: inherit;
      cursor: pointer;
      padding: 0.45rem 0.9rem;
      border: 1px solid var(--accent);
      border-radius: 8px;
      background: transparent;
      color: var(--accent);
    }
  `,
})
export class ReleaseNotes {
  protected readonly read = signal(false);
}
