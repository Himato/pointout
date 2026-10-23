import { Component, input } from '@angular/core';

@Component({
  selector: 'app-card',
  template: `
    <h3 class="title">{{ label() }}</h3>
    <p class="value">{{ value() }}</p>
    <p class="trend" [class.down]="trend() < 0">
      {{ trend() > 0 ? '+' : '' }}{{ trend() }}% this week
    </p>
  `,
  styles: `
    :host {
      display: block;
      padding: 1rem 1.25rem;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
    }
    .title {
      font-size: 0.9rem;
      color: var(--muted);
      font-weight: 500;
    }
    .value {
      margin: 0;
      font-size: 1.75rem;
      font-weight: 700;
    }
    .trend {
      margin: 0;
      color: var(--good);
    }
    .trend.down {
      color: var(--bad);
    }
  `,
})
export class DashboardCard {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly trend = input(0);
}
