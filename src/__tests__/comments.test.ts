import { groupCommentsIntoThreads } from '../lib/comments';
import type { Comment } from '../lib/comments';

function makeComment(overrides: Partial<Comment>): Comment {
  return {
    id: 'c1',
    user_id: 'u1',
    display_name: 'Someone',
    body: 'hi',
    created_at: '2026-01-01T00:00:00Z',
    parent_comment_id: null,
    ...overrides,
  };
}

// getComments() already returns rows ordered by created_at ascending -- these
// tests rely on that order being preserved through grouping, not re-sorted.
describe('groupCommentsIntoThreads', () => {
  it('puts top-level comments in order, each with no replies, when there are no replies', () => {
    const comments = [makeComment({ id: 'a' }), makeComment({ id: 'b' })];

    const threads = groupCommentsIntoThreads(comments);

    expect(threads.map((t) => t.comment.id)).toEqual(['a', 'b']);
    expect(threads[0].replies).toEqual([]);
    expect(threads[1].replies).toEqual([]);
  });

  it('nests a reply under its parent, not as its own top-level thread', () => {
    const comments = [
      makeComment({ id: 'a' }),
      makeComment({ id: 'reply-1', parent_comment_id: 'a' }),
    ];

    const threads = groupCommentsIntoThreads(comments);

    expect(threads).toHaveLength(1);
    expect(threads[0].comment.id).toBe('a');
    expect(threads[0].replies.map((r) => r.id)).toEqual(['reply-1']);
  });

  it('keeps multiple replies to the same parent in chronological order', () => {
    const comments = [
      makeComment({ id: 'a' }),
      makeComment({ id: 'reply-1', parent_comment_id: 'a', created_at: '2026-01-01T00:01:00Z' }),
      makeComment({ id: 'reply-2', parent_comment_id: 'a', created_at: '2026-01-01T00:02:00Z' }),
    ];

    const threads = groupCommentsIntoThreads(comments);

    expect(threads[0].replies.map((r) => r.id)).toEqual(['reply-1', 'reply-2']);
  });

  it('keeps replies to different parents separated', () => {
    const comments = [
      makeComment({ id: 'a' }),
      makeComment({ id: 'b' }),
      makeComment({ id: 'reply-to-b', parent_comment_id: 'b' }),
    ];

    const threads = groupCommentsIntoThreads(comments);

    expect(threads.find((t) => t.comment.id === 'a')!.replies).toEqual([]);
    expect(threads.find((t) => t.comment.id === 'b')!.replies.map((r) => r.id)).toEqual(['reply-to-b']);
  });
});
