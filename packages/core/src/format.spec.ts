import { describe, expect, it } from 'vitest';
import { defaultFormatter } from './format';
import type { PointoutBundle } from './types';

const viewport = { w: 1440, h: 900, colorScheme: 'dark' as const };

const bundle: PointoutBundle = {
  appName: 'Ops console',
  createdAt: '2026-10-23T09:00:00.000Z',
  viewport,
  comments: [
    {
      id: 'c1',
      n: 1,
      comment: 'Header should stick on scroll',
      url: '/alerts',
      owner: { framework: 'angular', component: 'AlertsTableComponent', chain: ['AlertsPage'] },
      domOwner: {
        tag: 'app-alerts-table',
        marker: 'custom-element',
        name: 'app-alerts-table',
        path: '#alerts-tbl',
      },
      selector: '#alerts-tbl',
      tag: 'table',
      text: 'SLA breach alerts',
      bbox: { x: 0, y: 120, w: 800, h: 400 },
      viewport,
      createdAt: '2026-10-23T08:58:00.000Z',
    },
    {
      id: 'c2',
      n: 2,
      comment: 'Wrong colour\nShould be red',
      url: '/alerts?tab=open',
      owner: null,
      domOwner: {
        tag: 'section',
        marker: 'landmark',
        name: 'sla',
        heading: 'SLA breach alerts',
        path: 'tr:nth-of-type(3)',
      },
      selector: 'tr:nth-of-type(3)',
      tag: 'tr',
      text: 'INC-42 late by 3h',
      bbox: { x: 0, y: 300, w: 800, h: 32 },
      viewport,
      createdAt: '2026-10-23T08:59:00.000Z',
    },
  ],
};

describe('defaultFormatter', () => {
  const output = defaultFormatter(bundle);

  it('writes the brief in the exact shape', () => {
    const brief = output.slice(0, output.indexOf('```json'));
    expect(brief).toBe(
      [
        'Pointout on Ops console — 2026-10-23T09:00:00.000Z',
        '2 items, viewport 1440×900, dark',
        '',
        '1. [AlertsTableComponent › #alerts-tbl] on /alerts — "SLA breach alerts"',
        '   Header should stick on scroll',
        '2. [<section "SLA breach alerts"> › tr:nth-of-type(3)] on /alerts?tab=open — "INC-42 late by 3h"',
        '   Wrong colour',
        '   Should be red',
        '',
        'Resolve each item in the component named; the selector is relative to that component. Ask before changing anything outside those components.',
        '',
        '',
      ].join('\n'),
    );
  });

  it('ends with a fenced JSON block that parses back to the bundle', () => {
    const match = /```json\n([\s\S]*)\n```$/.exec(output);
    expect(match).not.toBeNull();
    expect(JSON.parse(match?.[1] ?? '')).toEqual(bundle);
  });

  it('falls back to the boundary name when there is no heading', () => {
    const [, second] = bundle.comments;
    const noHeading = { ...second!, domOwner: { ...second!.domOwner, heading: undefined } };
    const text = defaultFormatter({ ...bundle, comments: [noHeading] });
    expect(text).toContain('2. [<section "sla"> › tr:nth-of-type(3)]');
  });

  it('names the source file next to the component when the owner has one', () => {
    const [first] = bundle.comments;
    const file = 'src/app/alerts/alerts-table.component.ts';
    const withFile = { ...first!, owner: { ...first!.owner!, file } };
    const text = defaultFormatter({ ...bundle, comments: [withFile] });
    expect(text).toContain(`1. [AlertsTableComponent (${file}) › #alerts-tbl] on /alerts`);
  });

  it('leaves out the quote when the element has no text', () => {
    const [first] = bundle.comments;
    const text = defaultFormatter({ ...bundle, comments: [{ ...first!, text: '' }] });
    expect(text).toContain('1. [AlertsTableComponent › #alerts-tbl] on /alerts\n');
    expect(text).not.toContain('— ""');
  });

  it('lists open items only and counts both kinds once anything is resolved', () => {
    const [first, second] = bundle.comments;
    const mixed = {
      ...bundle,
      comments: [
        { ...first!, status: 'resolved' as const },
        { ...second!, status: 'open' as const },
      ],
    };
    const text = defaultFormatter(mixed);
    const brief = text.slice(0, text.indexOf('```json'));

    expect(brief).toContain('1 open, 1 resolved, viewport 1440×900, dark');
    expect(brief).not.toContain('Header should stick on scroll');
    expect(brief).toContain('2. [<section "SLA breach alerts"> › tr:nth-of-type(3)]');
    const json = /```json\n([\s\S]*)\n```$/.exec(text)?.[1] ?? '';
    expect(JSON.parse(json)).toEqual(mixed);
  });

  it('says items when nothing is resolved, open status included', () => {
    const [first] = bundle.comments;
    const text = defaultFormatter({ ...bundle, comments: [{ ...first!, status: 'open' }] });
    expect(text).toContain('\n1 items, viewport');
  });
});
