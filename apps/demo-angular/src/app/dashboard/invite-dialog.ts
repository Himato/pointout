import { DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

export interface Invite {
  email: string;
  role: 'viewer' | 'editor' | 'admin';
}

@Component({
  selector: 'app-invite-dialog',
  imports: [ReactiveFormsModule],
  template: `
    <form class="panel" [formGroup]="form" (ngSubmit)="send()">
      <h2 id="invite-title">Invite a teammate</h2>
      <label>
        Email
        <input type="email" formControlName="email" data-testid="invite-email" />
      </label>
      <label>
        Role
        <select formControlName="role" data-testid="invite-role">
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <div class="actions">
        <button type="button" (click)="ref.close()">Cancel</button>
        <button type="submit" class="primary" [disabled]="form.invalid">Send invite</button>
      </div>
    </form>
  `,
  styles: `
    form {
      display: grid;
      gap: 1rem;
      width: min(420px, 90vw);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `,
})
export class InviteDialog {
  protected readonly ref = inject<DialogRef<Invite>>(DialogRef);
  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    role: new FormControl<Invite['role']>('viewer', { nonNullable: true }),
  });

  protected send(): void {
    this.ref.close(this.form.getRawValue());
  }
}
