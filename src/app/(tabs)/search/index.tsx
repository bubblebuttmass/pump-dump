import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../lib/auth';
import { searchUsers, isFollowing, follow, unfollow, UserResult } from '../../../lib/social-graph';

export default function Search() {
  const { session } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  async function handleSearch(text: string) {
    setQuery(text);
    if (!session?.user || text.trim().length === 0) {
      setResults([]);
      return;
    }
    const found = await searchUsers(text, session.user.id);
    setResults(found);
    const statuses = await Promise.all(found.map((u) => isFollowing(session.user.id, u.id)));
    setFollowingMap(Object.fromEntries(found.map((u, i) => [u.id, statuses[i]])));
  }

  async function handleToggleFollow(userId: string) {
    if (!session?.user) return;
    const currentlyFollowing = followingMap[userId];
    if (currentlyFollowing) {
      await unfollow(session.user.id, userId);
    } else {
      await follow(session.user.id, userId);
    }
    setFollowingMap((prev) => ({ ...prev, [userId]: !currentlyFollowing }));
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TextInput
        style={styles.input}
        placeholder="Search lifters by name..."
        value={query}
        onChangeText={handleSearch}
      />
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>{item.display_name}</Text>
            <Pressable style={styles.followButton} onPress={() => handleToggleFollow(item.id)}>
              <Text style={styles.followButtonText}>{followingMap[item.id] ? 'Unfollow' : 'Follow'}</Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  name: { fontSize: 16 },
  followButton: { backgroundColor: '#111', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  followButtonText: { color: '#fff', fontWeight: '600' },
});
