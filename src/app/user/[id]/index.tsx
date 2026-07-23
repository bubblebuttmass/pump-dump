import React, { useCallback, useState } from 'react';
import { View, Text, Image, FlatList, Pressable, StyleSheet } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { getProfile, ProfileSummary } from '../../../lib/profile';
import { isFollowing, follow, unfollow } from '../../../lib/social-graph';
import { AnimatedScreen } from '../../../components/AnimatedScreen';

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [followed, setFollowed] = useState(false);

  const isOwnProfile = session?.user?.id === id;

  const load = useCallback(async () => {
    if (!id) return;
    setProfile(await getProfile(id));
    if (session?.user && !isOwnProfile) {
      setFollowed(await isFollowing(session.user.id, id));
    }
  }, [id, session, isOwnProfile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleToggleFollow() {
    if (!session?.user || !id) return;
    if (followed) {
      await unfollow(session.user.id, id);
    } else {
      await follow(session.user.id, id);
    }
    setFollowed(!followed);
    setProfile((prev) =>
      prev ? { ...prev, followerCount: prev.followerCount + (followed ? -1 : 1) } : prev
    );
  }

  if (!profile) return <View style={styles.container} />;

  return (
    <AnimatedScreen style={styles.container}>
      <View style={styles.backBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backButton}>‹ Back</Text>
        </Pressable>
      </View>
      <View style={styles.header}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]} />
        )}
        <Text style={styles.name}>{profile.display_name}</Text>
        <Text style={profile.bio ? styles.bio : styles.bioEmpty}>{profile.bio ?? 'No bio yet'}</Text>
        {profile.traits.length > 0 && (
          <View style={styles.traitRow}>
            {profile.traits.map((trait) => (
              <View key={trait} style={styles.traitChip}>
                <Text style={styles.traitChipText}>{trait}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.countsRow}>
          <Pressable onPress={() => router.push({ pathname: '/user/[id]/followers', params: { id } })}>
            <Text style={styles.counts}>{profile.followerCount} followers</Text>
          </Pressable>
          <Text style={styles.counts}> · </Text>
          <Pressable onPress={() => router.push({ pathname: '/user/[id]/following', params: { id } })}>
            <Text style={styles.counts}>{profile.followingCount} following</Text>
          </Pressable>
        </View>
        {!isOwnProfile && (
          <Pressable style={styles.followButton} onPress={handleToggleFollow}>
            <Text style={styles.followButtonText}>{followed ? 'Unfollow' : 'Follow'}</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.sectionTitle}>Personal Records</Text>
      <FlatList
        data={profile.prList}
        keyExtractor={(item) => item.exercise_name}
        horizontal
        renderItem={({ item }) => (
          <View style={styles.prCard}>
            <Text style={styles.prExercise}>{item.exercise_name}</Text>
            <Text style={styles.prValue}>
              {item.weight} x {item.reps}
            </Text>
          </View>
        )}
      />

      <Text style={styles.sectionTitle}>Recent Posts</Text>
      <FlatList
        data={profile.recentWorkouts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const detail =
            item.title ??
            (item.sets.length > 0 ? `${item.sets.length} lift${item.sets.length > 1 ? 's' : ''} logged` : 'Pump post');
          return (
            <Pressable
              style={styles.workoutRow}
              onPress={() => router.push({ pathname: '/workout/[id]', params: { id: item.id } })}
            >
              <Text>{new Date(item.created_at).toLocaleDateString()} — {detail}</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyPosts}>
            {isOwnProfile ? 'No posts yet.' : "Follow to see this lifter's posts."}
          </Text>
        }
      />
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBar: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backButton: { color: '#0066cc', fontSize: 16, fontWeight: '600' },
  header: { alignItems: 'center', marginBottom: 24, paddingHorizontal: 16 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: { backgroundColor: '#eee' },
  name: { fontSize: 20, fontWeight: '700', marginTop: 8 },
  bio: { color: '#666', marginTop: 4, textAlign: 'center' },
  bioEmpty: { color: '#aaa', marginTop: 4, fontStyle: 'italic' },
  traitRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 10 },
  traitChip: { backgroundColor: '#f0f0f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  traitChipText: { fontSize: 12, fontWeight: '600', color: '#555' },
  countsRow: { flexDirection: 'row', marginTop: 8 },
  counts: { color: '#888' },
  followButton: { backgroundColor: '#111', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, marginTop: 12 },
  followButtonText: { color: '#fff', fontWeight: '600' },
  sectionTitle: { fontWeight: '700', fontSize: 16, marginTop: 16, marginBottom: 8, paddingHorizontal: 16 },
  prCard: { padding: 12, backgroundColor: '#f5f5f5', borderRadius: 8, marginRight: 8, marginLeft: 16 },
  prExercise: { fontWeight: '600' },
  prValue: { color: '#333', marginTop: 4 },
  workoutRow: { paddingVertical: 8, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#eee' },
  emptyPosts: { color: '#888', paddingHorizontal: 16, fontStyle: 'italic' },
});
