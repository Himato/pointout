import { afterEach, describe, expect, it } from 'vitest';
import { captureElement } from './capture';
import { locateComment } from './locate';
import type { OwnerInfo } from './types';

const CARDS = `
  <app-card id="revenue"><h2 class="title">Revenue</h2></app-card>
  <app-card id="churn"><h2 class="title">Churn</h2></app-card>`;

function owner(scope: Element): OwnerInfo {
  return { framework: 'test', component: 'Card', chain: [], scope };
}

function capture(el: Element, scope?: Element) {
  return captureElement(el, scope ? owner(scope) : null, '/');
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('locateComment', () => {
  it('finds a scoped selector through its anchor after the DOM is rebuilt', () => {
    document.body.innerHTML = CARDS;
    const host = document.querySelector('#churn')!;
    const stored = capture(host.querySelector('.title')!, host);
    expect(stored).toMatchObject({ selector: 'h2', anchor: '#churn' });

    document.body.innerHTML = CARDS;
    expect(locateComment(stored)?.textContent).toBe('Churn');
  });

  it('finds an element inside an open shadow root through its host', () => {
    document.body.innerHTML = '<x-chart id="chart"></x-chart>';
    const shadow = document.querySelector('#chart')!.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<p>Legend</p><button class="zoom">Zoom</button>';
    const stored = capture(shadow.querySelector('.zoom')!);
    expect(stored.anchor).toBe('#chart');

    expect(locateComment(stored)).toBe(shadow.querySelector('.zoom'));
  });

  it('still finds a document-unique selector without an anchor', () => {
    document.body.innerHTML = '<main><button id="save">Save</button></main>';
    const stored = capture(document.querySelector('#save')!);
    expect(stored.anchor).toBeUndefined();

    document.body.innerHTML = '<main><button id="save">Save</button></main>';
    expect(locateComment(stored)?.id).toBe('save');
  });

  it('gives up when the anchor is gone or ambiguous', () => {
    document.body.innerHTML = CARDS;
    expect(locateComment({ selector: '.title', anchor: '#nope' })).toBeNull();
    expect(locateComment({ selector: '.title', anchor: 'app-card' })).toBeNull();
  });
});
