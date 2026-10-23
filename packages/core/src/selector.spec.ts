import { afterEach, describe, expect, it } from 'vitest';
import { buildSelector, isGeneratedToken } from './selector';

function render(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

function pick(selector: string, root: ParentNode = document): Element {
  const el = root.querySelector(selector);
  if (!el) throw new Error(`fixture is missing ${selector}`);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('buildSelector', () => {
  it('prefers a unique id', () => {
    render(`<div><button id="save" data-testid="save-btn" class="btn">Save</button></div>`);
    expect(buildSelector(pick('button'))).toBe('#save');
  });

  it('falls back to data-testid when there is no id', () => {
    render(`<div><button data-testid="save-btn" class="btn">Save</button></div>`);
    expect(buildSelector(pick('button'))).toBe('[data-testid="save-btn"]');
  });

  it('skips a duplicated id', () => {
    render(`<p id="dup" class="a">one</p><p id="dup" class="b">two</p>`);
    expect(buildSelector(pick('p.b'))).toBe('.b');
  });

  it('returns the shortest unique selector', () => {
    render(`<ul class="list"><li>a</li><li class="active">b</li><li>c</li></ul><span>x</span>`);
    expect(buildSelector(pick('span'))).toBe('span');
    expect(buildSelector(pick('li.active'))).toBe('.active');
    expect(buildSelector(pick('li:nth-child(3)'))).toBe('li:nth-of-type(3)');
  });

  it('walks up only as far as needed and anchors on an ancestor id', () => {
    render(`
      <section id="alerts"><div class="row"><span class="cell">a</span></div></section>
      <section id="audit"><div class="row"><span class="cell">b</span></div></section>`);
    expect(buildSelector(pick('#audit .cell'))).toBe('#audit > div > span');
  });

  it('is stable when the same DOM shape is rendered again with new nodes', () => {
    const html = `<main><article class="card"><h2>A</h2></article><article class="card"><h2 class="title">B</h2></article></main>`;
    render(html);
    const first = buildSelector(pick('article:nth-of-type(2) h2'));
    render(html);
    const second = buildSelector(pick('article:nth-of-type(2) h2'));
    expect(first).toBe('.title');
    expect(second).toBe(first);
    expect(document.querySelectorAll(second)).toHaveLength(1);
  });

  it('is scoped to the shadow root the element lives in', () => {
    render(`<span class="label">outside</span><x-card></x-card>`);
    const shadow = pick('x-card').attachShadow({ mode: 'open' });
    shadow.innerHTML = `<div><span class="label">inside</span></div>`;
    const el = pick('.label', shadow);
    const selector = buildSelector(el);
    expect(selector).toBe('span');
    expect(shadow.querySelector(selector)).toBe(el);
  });

  it('is scoped to the given scope element', () => {
    render(`
      <app-table id="one"><div class="row"><b>a</b></div><div class="row"><b>b</b></div></app-table>
      <app-table id="two"><div class="row"><b>c</b></div><div class="row"><b>d</b></div></app-table>`);
    const scope = pick('#two');
    const el = pick('div:nth-of-type(2) b', scope);
    const selector = buildSelector(el, scope);
    expect(selector).toBe('div:nth-of-type(2) > b');
    expect(scope.querySelector(selector)).toBe(el);
  });

  it('skips generated classes', () => {
    render(`
      <div class="ng-star-inserted _ngcontent-abc-c12 css-1x9fa2k"><i>a</i></div>
      <div class="ng-star-inserted panel css-8q2zz1"><i>b</i></div>`);
    expect(buildSelector(pick('.panel'))).toBe('.panel');
    expect(buildSelector(pick('.panel i'))).toBe('.panel > i');
  });

  it('uses mat and cdk classes only when nothing better exists', () => {
    render(
      `<button class="mat-mdc-button save">a</button><button class="mat-mdc-icon-button">b</button>`,
    );
    expect(buildSelector(pick('.save'))).toBe('.save');
    expect(buildSelector(pick('.mat-mdc-icon-button'))).toBe('.mat-mdc-icon-button');
  });

  it('escapes odd characters', () => {
    render(`<div id="a:b"><span class="w-1/2">x</span><span class="w-1/2">y</span></div>`);
    const el = pick('span:nth-of-type(2)');
    const selector = buildSelector(el);
    expect(document.querySelector(selector)).toBe(el);
    expect(buildSelector(pick('div'))).toBe('#a\\:b');
  });
});

describe('isGeneratedToken', () => {
  it.each(['ng-star-inserted', '_ngcontent-ng-c123', '_nghost-abc', 'css-1x9fa2k', '_btn_a8f3c_1'])(
    'flags %s',
    (token) => expect(isGeneratedToken(token)).toBe(true),
  );

  it.each(['card', 'btn-primary', 'grid-cols-12', 'p-4', 'title'])('keeps %s', (token) =>
    expect(isGeneratedToken(token)).toBe(false),
  );
});
