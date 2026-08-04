import { createClient } from 'jsr:@supabase/supabase-js@2';

async function cleanupBucket(adminClient: ReturnType<typeof createClient>, bucket: string, userId: string) {
  try {
    const { data: files } = await adminClient.storage.from(bucket).list(userId);
    if (files && files.length > 0) {
      const paths = files.map((f) => `${userId}/${f.name}`);
      await adminClient.storage.from(bucket).remove(paths);
    }
  } catch {
    // Best-effort: a stray orphaned file shouldn't block account deletion,
    // which is the part that actually matters for the user's request.
  }
}

Deno.serve(async (req: Request) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
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
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    await cleanupBucket(adminClient, 'avatars', userId);
    await cleanupBucket(adminClient, 'workout-photos', userId);

    // Every table referencing users(id) does so ON DELETE CASCADE, so this
    // single call removes the person's entire footprint -- workouts, sets,
    // PRs, likes, comments, follows, bookmarks, notifications, blocks,
    // mutes, reports they filed -- not just their auth session.
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
