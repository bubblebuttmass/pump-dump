import { supabase } from './supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// supabase-js's storage sub-client doesn't reliably pick up the current
// session's access token in this React Native setup -- uploads went out
// carrying only the anon key, which RLS correctly rejected as "new row
// violates row-level security policy" (identical to an anon-only curl
// request). Fetching the session token and hitting the Storage REST API
// directly sidesteps that entirely.
async function uploadToBucket(bucket: string, userId: string, localUri: string, prefix: string): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Not signed in');

  const response = await fetch(localUri);
  const blob = await response.blob();
  const path = `${userId}/${prefix}-${Date.now()}.jpg`;

  const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
      'Content-Type': 'image/jpeg',
    },
    body: blob,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Upload failed: ${errorText}`);
  }

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  return uploadToBucket('avatars', userId, localUri, 'avatar');
}

export async function uploadWorkoutPhoto(userId: string, localUri: string): Promise<string> {
  return uploadToBucket('workout-photos', userId, localUri, 'workout');
}
