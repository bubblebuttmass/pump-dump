import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams, Href } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { getFollowing, getFollowStatus, follow, unfollow, UserResult, FollowStatus } from '../../../lib/social-graph';
import { showAlert } from '../../../lib/alert';
import { AnimatedScreen } from '../../../components/AnimatedScreen';
import { PressableScale } from '../../../components/PressableScale';
import { colors, radius, spacing, type as typeScale } from '../../../lib/theme';

export default function Following() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [users, setUsers] = useState<UserResult[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, FollowStatus>>({});

  useFocusEffect(
    useCallback(() => {
      if (!id || !session?.user) return;
      getFollowing(id).then(async (found) => {
        setUsers(found);
        const statuses = await Promise.all(found.map((u) => getFollowStatus(session.user.id, u.id)));
        setFollowingMap(Object.fromEntries(found.map((u, i) => [u.id, statuses[i]])));
      });
    }, [id, session])
  );

  async function handleToggleFollow(userId: string) {
    if (!session?.user) return;
    const current = followingMap[userId] ?? 'none';
    if (current === 'none') {
      setFollowingMap((prev) => ({ ...prev, [userId]: 'accepted' }));
      try {
        const status = await follow(session.user.id, userId);
        setFollowingMap((prev) => ({ ...prev, [userId]: status }));
      } catch (e: any) {
        setFollowingMap((prev) => ({ ...prev, [userId]: 'none' }));
        showAlert('Could not follow', e.message ?? String(e));
      }
    } else {
      setFollowingMap((prev) => ({ ...prev, [userId]: 'none' }));
      try {
        await unfollow(session.user.id, userId);
      } catch (e: any) {
        setFollowingMap((prev) => ({ ...prev, [userId]: current }));
        showAlert('Could not unfollow', e.message ?? String(e));
      }
    }
  }

  return (
    <AnimatedScreen style={styles.container}>
      <View style={styles.backBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </Pressable>
        <Text style={styles.title}>Following</Text>
      </View>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={36} color={colors.textFaint} />
            <Text style={styles.emptyText}>Not following anyone yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable
              style={styles.nameArea}
              onPress={() => router.push(`/user/${item.id}` as Href)}
            >
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" transition={200} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]} />
              )}
              <Text style={styles.name}>{item.display_name}</Text>
            </Pressable>
            {item.id !== session?.user?.id && (
              <PressableScale
                style={[styles.followButton, followingMap[item.id] === 'none' ? null : styles.followButtonActive]}
                onPress={() => handleToggleFollow(item.id)}
                scaleTo={0.94}
              >
                <Text style={[styles.followButtonText, followingMap[item.id] === 'none' ? null : styles.followButtonTextActive]}>
                  {followingMap[item.id] === 'accepted' ? 'Unfollow' : followingMap[item.id] === 'pending' ? 'Requested' : 'Follow'}
                </Text>
              </PressableScale>
            )}
          </View>
        )}
      />
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  backBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs, gap: spacing.lg },
  title: { ...typeScale.subtitle, color: colors.text },
  list: { padding: spacing.lg },
  empty: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxl },
  emptyText: { ...typeScale.body, color: colors.textFaint },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  nameArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { backgroundColor: colors.surfaceRaised },
  name: { ...typeScale.body, color: colors.text },
  followButton: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm },
  followButtonActive: { backgroundColor: colors.surfaceRaised },
  followButtonText: { ...typeScale.caption, color: colors.white, fontWeight: '700' },
  followButtonTextActive: { color: colors.textMuted },
});
