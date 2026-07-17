import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Image, StyleSheet, RefreshControl, Pressable } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { getFeed, FeedPost } from '../../../lib/feed';

export default function Feed() {
  const { session } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user) return;
    setPosts(await getFeed(session.user.id));
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text>No posts yet. Follow lifters in Search to fill your feed.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push({ pathname: '/workout/[id]', params: { id: item.id } })}
          >
            <View style={styles.headerRow}>
              <Text style={styles.name}>{item.display_name}</Text>
              {item.hasPR && <Text style={styles.prBadge}>New PR!</Text>}
            </View>
            {item.photo_url && <Image source={{ uri: item.photo_url }} style={styles.photo} />}
            {item.sets.slice(0, 3).map((s, i) => (
              <Text key={i} style={styles.setLine}>
                {s.exercise_name}: {s.weight}
                {s.unit} x {s.reps}
              </Text>
            ))}
            {item.sets.length > 3 && <Text style={styles.more}>+{item.sets.length - 3} more sets</Text>}
            <Text style={styles.meta}>
              {item.likeCount} likes · {item.commentCount} comments
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { padding: 32, alignItems: 'center' },
  card: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontWeight: '700', fontSize: 16 },
  prBadge: { backgroundColor: '#ffd700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, fontSize: 12 },
  photo: { width: '100%', height: 220, borderRadius: 8, marginTop: 8 },
  setLine: { color: '#333', marginTop: 4 },
  more: { color: '#888', marginTop: 4 },
  meta: { color: '#888', marginTop: 8, fontSize: 12 },
});
