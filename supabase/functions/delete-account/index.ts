import { createClient } from 'jsr:@supabase/supabase-js@2';

// Supabase captures whatever this function writes to stdout/stderr as its
// function logs (viewable in the dashboard / via the logs API) -- writing
// one JSON object per line turns that into something greppable/queryable
// instead of freeform text, without pulling in a logging library that has
// nothing to attach to here (no long-running process, no log shipper).
function log(requestId: string, event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), requestId, event, ...fields }));
}

async function cleanupBucket(adminClient: ReturnType<typeof createClient>, bucket: string, userId: string, requestId: string) {
  try {
    const { data: files } = await adminClient.storage.from(bucket).list(userId);
    if (files && files.length > 0) {
      const paths = files.map((f) => `${userId}/${f.name}`);
      await adminClient.storage.from(bucket).remove(paths);
    }
  } catch (e) {
    // Best-effort: a stray orphaned file shouldn't block account deletion,
    // which is the part that actually matters for the user's request. Still
    // logged, so an accumulating pattern of failures is visible.
    log(requestId, 'bucket_cleanup_failed', { bucket, userId, error: String(e) });
  }
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  log(requestId, 'request_received');

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      log(requestId, 'rejected_no_auth_header');
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // The user id comes from validating the CALLER's own token, never from
    // the request body -- this is what guarantees a user can only ever
    // delete their own account, not someone else's.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      log(requestId, 'rejected_invalid_session', { error: userError?.message });
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;
    log(requestId, 'session_validated', { userId });

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    await cleanupBucket(adminClient, 'avatars', userId, requestId);
    await cleanupBucket(adminClient, 'workout-photos', userId, requestId);

    // Every table referencing users(id) does so ON DELETE CASCADE, so this
    // single call removes the person's entire footprint -- workouts, sets,
    // PRs, likes, comments, follows, bookmarks, notifications, blocks,
    // mutes, reports they filed -- not just their auth session.
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      log(requestId, 'delete_failed', { userId, error: deleteError.message });
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    log(requestId, 'delete_succeeded', { userId });
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    log(requestId, 'unhandled_exception', { error: String(e) });
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
