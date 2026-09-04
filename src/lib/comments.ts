// Pure comment-thread shaping logic, kept separate from social.ts (which
// imports supabase.ts, and so can't be imported in a unit test without live
// Supabase env vars -- see src/__tests__/comments.test.ts).

export interface Comment {
  id: string;
  user_id: string;
  display_name: string;
  body: string;
  created_at: string;
  // null for a top-level comment. A reply always points at the top-level
  // comment it belongs to -- replying to a reply flattens into the same
  // thread rather than nesting further (see addComment in social.ts).
  parent_comment_id: string | null;
}

export interface CommentThread {
  comment: Comment;
  replies: Comment[];
}

// getComments() returns rows ordered by created_at ascending -- this only
// groups, it doesn't re-sort, so that order is preserved within both the
// top-level list and each thread's replies.
export function groupCommentsIntoThreads(comments: Comment[]): CommentThread[] {
  const repliesByParent = new Map<string, Comment[]>();
  const topLevel: Comment[] = [];

  for (const c of comments) {
    if (c.parent_comment_id) {
      const list = repliesByParent.get(c.parent_comment_id);
      if (list) list.push(c);
      else repliesByParent.set(c.parent_comment_id, [c]);
    } else {
      topLevel.push(c);
    }
  }

  return topLevel.map((comment) => ({ comment, replies: repliesByParent.get(comment.id) ?? [] }));
}
