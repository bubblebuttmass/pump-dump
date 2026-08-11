import * as Crypto from 'expo-crypto';
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
  // These buckets are public (public URLs bypass RLS entirely), so the
  // filename is the only thing standing between "you have the link" and
  // "you can guess it" -- a timestamp is guessable within a narrow window
  // by anyone who saw the post's created_at. Random bytes aren't. Same
  // getRandomBytesAsync API already relied on in secureStorage.ts.
  const randomBytes = await Crypto.getRandomBytesAsync(16);
  const random = Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const path = `${userId}/${prefix}-${random}.jpg`;

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

export async function uploadWorkoutPhotos(userId: string, localUris: string[]): Promise<string[]> {
  return Promise.all(localUris.map((uri, i) => uploadToBucket('workout-photos', userId, uri, `workout-${i}`)));
}

// Best-effort: the DB row is the source of truth for whether a post exists,
// so a failed cleanup here shouldn't block or fail the delete -- it would
// just leave an orphaned file in storage, not a broken app state.
export async function deleteWorkoutPhotos(urls: string[]): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return;

  const marker = '/object/public/workout-photos/';
  await Promise.all(
    urls.map(async (url) => {
      const idx = url.indexOf(marker);
      if (idx === -1) return;
      const path = url.slice(idx + marker.length);
      try {
        await fetch(`${supabaseUrl}/storage/v1/object/workout-photos/${path}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey },
        });
      } catch {
        // orphaned file, not a broken app state -- see comment above
      }
    })
  );
}
