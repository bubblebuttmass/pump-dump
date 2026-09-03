import { createClient } from 'jsr:@supabase/supabase-js@2';

// Only Postgres calls this (via the trigger_push_on_notification trigger),
// never a client directly -- verify_jwt is off for this function, and this
// shared secret is the actual gate instead. Must match the value baked
// into that trigger's http_post call.
const WEBHOOK_SECRET = '21d7bf69a7540252588692650fffb457413327eff9896d2a9968825b2ce8abd8';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const MESSAGES: Record<string, (actorName: string) => string> = {
  like: (actorName) => `${actorName} liked your pump`,
  comment: (actorName) => `${actorName} commented on your pump`,
  comment_reply: (actorName) => `${actorName} replied to your comment`,
  follow: (actorName) => `${actorName} started following you`,
};

function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...fields }));
}

Deno.serve(async (req: Request) => {
  try {
    if (req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
      log('rejected_bad_secret');
      return new Response('Unauthorized', { status: 401 });
    }

    const { notification_id } = await req.json();
    if (!notification_id) return new Response('ok');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: notif, error: notifError } = await admin
      .from('notifications')
      .select('id, user_id, type, workout_id, actor:actor_id ( display_name )')
      .eq('id', notification_id)
      .single();
    if (notifError || !notif) {
      log('notification_not_found', { notification_id, error: notifError?.message });
      return new Response('ok');
    }

    const { data: tokens, error: tokensError } = await admin
      .from('push_tokens')
      .select('token')
      .eq('user_id', notif.user_id);
    if (tokensError) {
      log('token_lookup_failed', { userId: notif.user_id, error: tokensError.message });
      return new Response('ok');
    }
    if (!tokens || tokens.length === 0) {
      log('no_tokens', { userId: notif.user_id });
      return new Response('ok');
    }

    const actorName = (notif as any).actor?.display_name ?? 'Someone';
    const body = MESSAGES[notif.type]?.(actorName) ?? 'New activity on Pump Dump';

    const messages = tokens.map((t: any) => ({
      to: t.token,
      title: 'Pump Dump',
      body,
      data: { type: notif.type, workoutId: notif.workout_id },
    }));

    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });

    log('push_sent', { userId: notif.user_id, type: notif.type, recipientCount: tokens.length, expoStatus: pushResponse.status });
    return new Response('ok');
  } catch (e) {
    log('unhandled_exception', { error: String(e) });
    return new Response('error', { status: 500 });
  }
});
