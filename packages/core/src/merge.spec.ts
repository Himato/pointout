import { describe, expect, it } from 'vitest';
import { mergeRecords, withIds } from './merge';
import type { PointoutComment } from './types';

const c = (id: string, extra: Partial<PointoutComment> = {}) =>
  ({ id, n: 1, comment: 'x', ...extra }) as PointoutComment;
const reply = { from: 'claude' as const, text: 'On it', at: '2026-10-23T09:00:00.000Z' };

describe('mergeRecords', () => {
  it('returns null when the hub says nothing new', () => {
    expect(mergeRecords([c('a')], [{ id: 'a' }, { id: 'unknown', status: 'resolved' }])).toBeNull();
    expect(mergeRecords([c('a', { status: 'open' })], [{ id: 'a' }])).toBeNull();
  });

  it('takes status, replies and session from the hub, keeps the rest', () => {
    const result = mergeRecords([c('a')], [{ id: 'a', sessionId: 's1', replies: [reply] }]);
    expect(result).toEqual({
      comments: [c('a', { sessionId: 's1', replies: [reply] })],
      flash: 'Claude replied',
    });
  });

  it('flashes once per merge, resolved winning over replied', () => {
    const result = mergeRecords(
      [c('a'), c('b')],
      [
        { id: 'a', status: 'resolved', replies: [reply] },
        { id: 'b', replies: [reply] },
      ],
    );
    expect(result?.flash).toBe('Resolved by Claude');
  });

  it('reopens quietly', () => {
    const result = mergeRecords([c('a', { status: 'resolved' })], [{ id: 'a', status: 'open' }]);
    expect(result).toEqual({ comments: [c('a', { status: 'open' })], flash: null });
  });
});

describe('withIds', () => {
  it('fills missing ids and leaves a complete list alone', () => {
    const complete = [c('a')];
    expect(withIds(complete)).toBe(complete);
    const [fixed] = withIds([{ ...c('a'), id: undefined } as unknown as PointoutComment]);
    expect(fixed!.id).toMatch(/\S{6,}/);
  });
});
