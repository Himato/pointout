import { Dialog } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { DashboardCard } from './dashboard-card';
import { InviteDialog, type Invite } from './invite-dialog';
import { ReleaseNotes } from './release-notes';

interface Deploy {
  id: string;
  service: string;
  author: string;
  status: 'live' | 'failed' | 'rolling';
}

@Component({
  selector: 'app-dashboard',
  imports: [DashboardCard, ReleaseNotes],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private readonly dialog = inject(Dialog);

  protected readonly invited = signal<Invite | null>(null);
  protected readonly deploys: Deploy[] = [
    { id: 'd-104', service: 'checkout', author: 'Sam', status: 'live' },
    { id: 'd-103', service: 'search', author: 'Ana', status: 'failed' },
    { id: 'd-102', service: 'auth', author: 'Lee', status: 'rolling' },
    { id: 'd-101', service: 'checkout', author: 'Ana', status: 'live' },
  ];

  protected openInvite(): void {
    this.dialog
      .open<Invite>(InviteDialog, { ariaLabelledBy: 'invite-title' })
      .closed.subscribe((invite) => {
        if (invite) this.invited.set(invite);
      });
  }
}
