import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Push permission is requested only when someone explicitly flips the
// Settings toggle on -- same lazy, meaningful-moment pattern as location
// (never on launch, never bundled into onboarding).
export async function registerForPushNotifications(userId: string): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return false;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  // onConflict: 'token', not 'user_id' -- a token belongs to one physical
  // device/install, and re-registering (reinstall, or a different account
  // signing into the same device) should reassign that row to whoever's
  // registering now rather than create duplicates.
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ user_id: userId, token, platform: Platform.OS }, { onConflict: 'token' });
  if (error) throw error;

  return true;
}

export async function unregisterPushNotifications(userId: string): Promise<void> {
  const { error } = await supabase.from('push_tokens').delete().eq('user_id', userId);
  if (error) throw error;
}

export async function hasPushToken(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('push_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return (count ?? 0) > 0;
}
