import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams, Href } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { getFollowing, isFollowing, follow, unfollow, UserResult } from '../../../lib/social-graph';

export default function Following() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [users, setUsers] = useState<UserResult[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  useFocusEffect(
    useCallback(() => {
      if (!id || !session?.user) return;
      getFollowing(id).then(async (found) => {
        setUsers(found);
        const statuses = await Promise.all(found.map((u) => isFollowing(session.user.id, u.id)));
        setFollowingMap(Object.fromEntries(found.map((u, i) => [u.id, statuses[i]])));
      });
    }, [id, session])
  );

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
      <View style={styles.backBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backButton}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Following</Text>
      </View>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Not following anyone yet</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable
              style={styles.nameArea}
              onPress={() => router.push(`/user/${item.id}` as Href)}
            >
              <Text style={styles.name}>{item.display_name}</Text>
            </Pressable>
            {item.id !== session?.user?.id && (
              <Pressable style={styles.followButton} onPress={() => handleToggleFollow(item.id)}>
                <Text style={styles.followButtonText}>{followingMap[item.id] ? 'Unfollow' : 'Follow'}</Text>
              </Pressable>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, gap: 16 },
  backButton: { color: '#0066cc', fontSize: 16, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700' },
  list: { padding: 16 },
  empty: { color: '#888', textAlign: 'center', marginTop: 32 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  nameArea: { flex: 1 },
  name: { fontSize: 16 },
  followButton: { backgroundColor: '#111', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  followButtonText: { color: '#fff', fontWeight: '600' },
});
