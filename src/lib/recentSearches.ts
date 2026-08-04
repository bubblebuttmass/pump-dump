import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_RECENT = 6;

function storageKey(userId: string): string {
  return `pump_recent_searches_${userId}`;
}

export async function getRecentSearches(userId: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  return raw ? JSON.parse(raw) : [];
}

export async function addRecentSearch(userId: string, query: string): Promise<void> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return;
  const existing = await getRecentSearches(userId);
  const deduped = [trimmed, ...existing.filter((q) => q.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT);
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(deduped));
}

export async function removeRecentSearch(userId: string, query: string): Promise<void> {
  const existing = await getRecentSearches(userId);
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(existing.filter((q) => q !== query)));
}
