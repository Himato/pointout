import { afterEach, describe, expect, it } from 'vitest';
import { resolveDomOwner } from './dom-owner';

function render(html: string): void {
  document.body.innerHTML = html;
}

function pick(selector: string, root: ParentNode = document): Element {
  const el = root.querySelector(selector);
  if (!el) throw new Error(`fixture is missing ${selector}`);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('resolveDomOwner', () => {
  it('walks the markers in priority order on the same ancestor', () => {
    render(`
      <app-panel id="owner" data-component="AlertsPanel" data-testid="alerts" _nghost-ng-c1 role="region">
        <b>x</b>
      </app-panel>`);
    const owner = pick('#owner');
    const target = pick('b');

    expect(resolveDomOwner(target)).toMatchObject({
      marker: 'data-component',
      name: 'AlertsPanel',
    });

    owner.removeAttribute('data-component');
    expect(resolveDomOwner(target)).toMatchObject({ marker: 'data-testid', name: 'alerts' });

    owner.removeAttribute('data-testid');
    expect(resolveDomOwner(target)).toMatchObject({ marker: 'custom-element', name: 'app-panel' });
  });

  it('matches host attributes on plain tags', () => {
    for (const attr of ['_nghost-ng-c7', 'ng-version', 'data-v-3f2a', 'data-reactroot']) {
      render(`<div ${attr}><i>x</i></div>`);
      expect(resolveDomOwner(pick('i'))).toMatchObject({ marker: 'host-attr', tag: 'div' });
    }
  });

  it('matches labelled landmarks and ignores unlabelled ones', () => {
    render(
      `<main><section aria-label="SLA breach alerts"><p>x</p></section><section><p class="y">y</p></section></main>`,
    );
    expect(resolveDomOwner(pick('p'))).toMatchObject({
      marker: 'landmark',
      tag: 'section',
      name: 'SLA breach alerts',
    });
    expect(resolveDomOwner(pick('.y')).marker).toBe('document');

    render(`<div role="region" id="audit"><p>x</p></div>`);
    expect(resolveDomOwner(pick('p'))).toMatchObject({ marker: 'landmark', name: 'audit' });
  });

  it('picks the nearest heading above the element', () => {
    render(`
      <section id="alerts">
        <h2>Alerts</h2>
        <div><h3>SLA breach alerts</h3></div>
        <table><tr><td class="cell">late</td></tr></table>
        <h3>After the element</h3>
      </section>`);
    expect(resolveDomOwner(pick('.cell')).heading).toBe('SLA breach alerts');
  });

  it('uses the boundary aria-label when there is no heading', () => {
    render(`<nav aria-label="Main menu"><a href="#">Home</a></nav>`);
    expect(resolveDomOwner(pick('a')).heading).toBe('Main menu');
  });

  it('does not borrow headings from outside the boundary', () => {
    render(`<h1>Page</h1><section id="s"><p>x</p></section>`);
    expect(resolveDomOwner(pick('p')).heading).toBeUndefined();
  });

  it('caps heading text at 80 characters with whitespace collapsed', () => {
    render(`<h2>  ${'word '.repeat(40)}  </h2><p>x</p>`);
    const heading = resolveDomOwner(pick('p')).heading ?? '';
    expect(heading).toHaveLength(80);
    expect(heading).not.toMatch(/\s{2}/);
  });

  it('builds a short path from the boundary to the element', () => {
    render(`
      <app-table>
        <div class="row"><span>a</span></div>
        <div class="row"><span>b</span></div>
      </app-table>
      <app-table><div class="row"><span>c</span></div></app-table>`);
    const target = pick('app-table div:nth-of-type(2) span');
    const info = resolveDomOwner(target);
    expect(info.path).toBe('div:nth-of-type(2) > span');
    expect(pick('app-table').querySelector(info.path)).toBe(target);
  });

  it('falls back to the document', () => {
    render(`<div><p>x</p></div>`);
    expect(resolveDomOwner(pick('p'))).toEqual({
      tag: 'html',
      marker: 'document',
      name: 'document',
      path: 'p',
    });
  });

  it('crosses shadow roots to find the host', () => {
    render(`<x-widget></x-widget>`);
    const shadow = pick('x-widget').attachShadow({ mode: 'open' });
    shadow.innerHTML = `<h4>Widget</h4><button>Go</button>`;
    expect(resolveDomOwner(pick('button', shadow))).toMatchObject({
      marker: 'custom-element',
      name: 'x-widget',
      heading: 'Widget',
      path: 'button',
    });
  });

  it('ignores <point-out> itself', () => {
    render(`<point-out><p>x</p></point-out>`);
    expect(resolveDomOwner(pick('p')).marker).toBe('document');
  });
});
