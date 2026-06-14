import { describe, expect, it } from 'vitest';
import { buildRewindTargets } from './rewindTargets';

describe('buildRewindTargets', () => {
  it('uses server-provided turn text instead of client transcript indexes', () => {
    expect(
      buildRewindTargets([
        {
          promptId: 'p2',
          turnIndex: 2,
          text: '  second real prompt  ',
          timestamp: '2026-06-11T00:00:00.000Z',
          diffStats: { filesChanged: 0, insertions: 0, deletions: 0 },
        },
        {
          promptId: 'p0',
          turnIndex: 0,
          text: '?help-like prompt that reached the model',
          timestamp: '2026-06-10T00:00:00.000Z',
          diffStats: { filesChanged: 0, insertions: 0, deletions: 0 },
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        promptId: 'p0',
        turnIndex: 0,
        text: '?help-like prompt that reached the model',
      }),
      expect.objectContaining({
        promptId: 'p2',
        turnIndex: 2,
        text: 'second real prompt',
      }),
    ]);
  });
});
