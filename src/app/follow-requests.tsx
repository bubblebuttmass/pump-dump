import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, Href } from 'expo-router';
import { useAuth } from '../lib/auth';
import { getFollowRequests, acceptFollowRequest, declineFollowRequest, FollowRequest } from '../lib/social-graph';
import { showAlert } from '../lib/alert';
import { AnimatedScreen } from '../components/AnimatedScreen';
import { PressableScale } from '../components/PressableScale';
import { useThemeColors, radius, spacing, type as typeScale, ThemeColors } from '../lib/theme';

export default function FollowRequests() {
  const { session } = useAuth();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [requests, setRequests] = useState<FollowRequest[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!session?.user) return;
      getFollowRequests(session.user.id).then(setRequests);
    }, [session])
  );

  async function handleAccept(followerId: string) {
    if (!session?.user) return;
    const removed = requests.find((r) => r.followerId === followerId);
    setRequests((prev) => prev.filter((r) => r.followerId !== followerId));
    try {
      await acceptFollowRequest(followerId, session.user.id);
    } catch (e: any) {
      if (removed) setRequests((prev) => [removed, ...prev]);
      showAlert('Could not accept request', e.message ?? String(e));
    }
  }

  async function handleDecline(followerId: string) {
    if (!session?.user) return;
    const removed = requests.find((r) => r.followerId === followerId);
    setRequests((prev) => prev.filter((r) => r.followerId !== followerId));
    try {
      await declineFollowRequest(followerId, session.user.id);
    } catch (e: any) {
      if (removed) setRequests((prev) => [removed, ...prev]);
      showAlert('Could not decline request', e.message ?? String(e));
    }
  }

  return (
    <AnimatedScreen style={styles.container}>
      <View style={styles.backBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </Pressable>
        <Text style={styles.title}>Follow Requests</Text>
      </View>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.followerId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="person-add-outline" size={36} color={colors.textFaint} />
            <Text style={styles.emptyText}>No pending requests</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable
              style={styles.nameArea}
              onPress={() => router.push(`/user/${item.followerId}` as Href)}
            >
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" transition={200} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]} />
              )}
              <Text style={styles.name}>{item.display_name}</Text>
            </Pressable>
            <View style={styles.actions}>
              <PressableScale style={styles.acceptButton} onPress={() => handleAccept(item.followerId)} scaleTo={0.92}>
                <Text style={styles.acceptButtonText}>Accept</Text>
              </PressableScale>
              <PressableScale style={styles.declineButton} onPress={() => handleDecline(item.followerId)} scaleTo={0.92} haptic="none">
                <Text style={styles.declineButtonText}>Decline</Text>
              </PressableScale>
            </View>
          </View>
        )}
      />
    </AnimatedScreen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
    nameArea: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
    avatar: { width: 36, height: 36, borderRadius: 18 },
    avatarPlaceholder: { backgroundColor: colors.surfaceRaised },
    name: { ...typeScale.body, color: colors.text },
    actions: { flexDirection: 'row', gap: spacing.sm },
    acceptButton: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm },
    acceptButtonText: { ...typeScale.caption, color: colors.white, fontWeight: '700' },
    declineButton: { backgroundColor: colors.surfaceRaised, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm },
    declineButtonText: { ...typeScale.caption, color: colors.textMuted, fontWeight: '700' },
  });
}
