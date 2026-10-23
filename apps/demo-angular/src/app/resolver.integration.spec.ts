import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { angularOwnerResolver } from '@pointout/angular';

@Component({
  selector: 'app-card',
  template: `<button type="button">Open {{ label() }}</button>`,
})
class CardComponent {
  readonly label = input('');
}

@Component({
  selector: 'app-host',
  imports: [CardComponent],
  template: `<section><app-card label="Revenue" /></section>`,
})
class HostComponent {}

@Component({
  selector: 'app-page',
  imports: [HostComponent],
  template: `<app-host />`,
})
class PageComponent {}

describe('angularOwnerResolver on real Ivy', () => {
  it('names the card, its parents, its selector and its inputs', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const card = (fixture.nativeElement as HTMLElement).querySelector('app-card')!;
    const button = card.querySelector('button')!;
    // Ivy only answers for attached nodes, and so does the resolver.
    document.body.append(fixture.nativeElement as HTMLElement);

    const owner = angularOwnerResolver(button);

    expect(owner).toMatchObject({
      framework: 'angular',
      component: 'CardComponent',
      hint: 'app-card',
      props: { label: 'Revenue' },
    });
    expect(owner?.chain).toContain('HostComponent');
    expect(owner?.scope).toBe(card);
    expect(owner?.file).toMatch(/resolver\.integration\.spec\.ts$/);
  });

  it('stops the chain at the routed component', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'page', component: PageComponent }])],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/page', PageComponent);
    const button = harness.routeNativeElement!.querySelector('app-card button')!;
    document.body.append(harness.fixture.nativeElement as HTMLElement);

    const owner = angularOwnerResolver(button);

    expect(owner?.component).toBe('CardComponent');
    expect(owner?.chain).toEqual(['HostComponent', 'PageComponent']);
  });
});
