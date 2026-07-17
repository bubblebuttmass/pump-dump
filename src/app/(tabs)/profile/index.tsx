import React, { useCallback, useState } from 'react';
import { View, Text, Image, FlatList, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { getOwnProfile, ProfileSummary } from '../../../lib/profile';

export default function Profile() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<ProfileSummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (session?.user) getOwnProfile(session.user.id).then(setProfile);
    }, [session])
  );

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (!profile) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]} />
        )}
        <Text style={styles.name}>{profile.display_name}</Text>
        <Text style={profile.bio ? styles.bio : styles.bioEmpty}>{profile.bio ?? 'No bio yet'}</Text>
        <Text style={styles.counts}>
          {profile.followerCount} followers · {profile.followingCount} following
        </Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.editButton} onPress={() => router.push('/(tabs)/profile/edit')}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </Pressable>
          <Pressable onPress={handleSignOut}>
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
        </View>
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

      <Text style={styles.sectionTitle}>Recent Workouts</Text>
      <FlatList
        data={profile.recentWorkouts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.workoutRow}
            onPress={() => router.push({ pathname: '/workout/[id]', params: { id: item.id } })}
          >
            <Text>{new Date(item.created_at).toLocaleDateString()} — {item.sets.length} sets</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: { backgroundColor: '#eee' },
  name: { fontSize: 20, fontWeight: '700', marginTop: 8 },
  bio: { color: '#666', marginTop: 4, textAlign: 'center' },
  bioEmpty: { color: '#aaa', marginTop: 4, fontStyle: 'italic' },
  counts: { color: '#888', marginTop: 8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  editButton: { backgroundColor: '#f5f5f5', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  editButtonText: { color: '#111', fontWeight: '600' },
  signOut: { color: '#cc0000' },
  sectionTitle: { fontWeight: '700', fontSize: 16, marginTop: 16, marginBottom: 8 },
  prCard: { padding: 12, backgroundColor: '#f5f5f5', borderRadius: 8, marginRight: 8 },
  prExercise: { fontWeight: '600' },
  prValue: { color: '#333', marginTop: 4 },
  workoutRow: { paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' },
});
