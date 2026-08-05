import * as Location from 'expo-location';
import { supabase } from './supabase';

export interface NearbyGym {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distanceMeters: number;
}

export type LocationResult =
  | { status: 'ok'; coords: { lat: number; lng: number } }
  | { status: 'denied' }
  | { status: 'error'; message: string };

// One-shot "where am I right now" for the moment someone taps "tag a gym" --
// not a subscription/watcher, so there's no ongoing tracking to worry about
// once this call resolves. Permission is requested here, lazily, only when
// the feature is actually used, never on app launch.
export async function getCurrentLocationOnce(): Promise<LocationResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { status: 'denied' };

    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { status: 'ok', coords: { lat: position.coords.latitude, lng: position.coords.longitude } };
  } catch (e: any) {
    return { status: 'error', message: e.message ?? String(e) };
  }
}

export async function getNearbyGyms(lat: number, lng: number, radiusMeters = 1500): Promise<NearbyGym[]> {
  const { data, error } = await supabase.rpc('nearby_gyms', { p_lat: lat, p_lng: lng, p_radius_meters: radiusMeters });
  if (error) throw error;
  return (data ?? []).map((g: any) => ({
    id: g.id,
    name: g.name,
    lat: g.lat,
    lng: g.lng,
    distanceMeters: g.distance_meters,
  }));
}

export async function createGym(name: string, lat: number, lng: number, createdBy: string): Promise<NearbyGym> {
  const { data, error } = await supabase
    .from('gyms')
    .insert({ name: name.trim(), lat, lng, created_by: createdBy })
    .select('id, name, lat, lng')
    .single();
  if (error) throw error;
  return { id: data.id, name: data.name, lat: data.lat, lng: data.lng, distanceMeters: 0 };
}
