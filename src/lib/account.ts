import { supabase } from './supabase';

// Deleting the auth user (and everything cascading from it) has to happen
// server-side with the service-role key -- that key can never live in the
// client bundle, so this calls a Supabase Edge Function instead of doing
// it directly. The function re-derives the caller's identity from their
// own session token, so a user can only ever delete their own account.
export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-account');
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}
