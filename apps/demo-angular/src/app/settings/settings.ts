import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Theme } from '../theme';

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings {
  protected readonly theme = inject(Theme);
  protected readonly saved = signal(false);
  protected readonly form = new FormGroup({
    name: new FormControl('Ada Lovelace', { nonNullable: true, validators: Validators.required }),
    email: new FormControl('ada@example.com', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    digest: new FormControl(true, { nonNullable: true }),
  });

  protected save(): void {
    this.saved.set(true);
    this.form.markAsPristine();
  }
}
