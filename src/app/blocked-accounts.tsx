import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../lib/auth';
import { getBlockedUsers, unblockUser } from '../lib/moderation';
import { showAlert } from '../lib/alert';
import { UserResult } from '../lib/social-graph';
import { AnimatedScreen } from '../components/AnimatedScreen';
import { PressableScale } from '../components/PressableScale';
import { colors, radius, spacing, type as typeScale } from '../lib/theme';

export default function BlockedAccounts() {
  const { session } = useAuth();
  const [users, setUsers] = useState<UserResult[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!session?.user) return;
      getBlockedUsers(session.user.id).then(setUsers);
    }, [session])
  );

  async function handleUnblock(userId: string) {
    if (!session?.user) return;
    const removed = users.find((u) => u.id === userId);
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    try {
      await unblockUser(session.user.id, userId);
    } catch (e: any) {
      if (removed) setUsers((prev) => [removed, ...prev]);
      showAlert('Could not unblock', e.message ?? String(e));
    }
  }

  return (
    <AnimatedScreen style={styles.container}>
      <View style={styles.backBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </Pressable>
        <Text style={styles.title}>Blocked Accounts</Text>
      </View>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="shield-checkmark-outline" size={36} color={colors.textFaint} />
            <Text style={styles.emptyText}>No blocked accounts</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" transition={200} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]} />
            )}
            <Text style={styles.name}>{item.display_name}</Text>
            <PressableScale style={styles.unblockButton} onPress={() => handleUnblock(item.id)} scaleTo={0.92}>
              <Text style={styles.unblockButtonText}>Unblock</Text>
            </PressableScale>
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
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarPlaceholder: { backgroundColor: colors.surfaceRaised },
  name: { ...typeScale.body, color: colors.text, flex: 1 },
  unblockButton: { backgroundColor: colors.surfaceRaised, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm },
  unblockButtonText: { ...typeScale.caption, color: colors.textMuted, fontWeight: '700' },
});
