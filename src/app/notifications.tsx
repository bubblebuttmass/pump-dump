import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, Href } from 'expo-router';
import { useAuth } from '../lib/auth';
import { getNotifications, markAllRead, AppNotification } from '../lib/notifications';
import { formatRelativeTime } from '../lib/time';
import { AnimatedScreen } from '../components/AnimatedScreen';
import { useThemeColors, radius, spacing, type as typeScale, ThemeColors } from '../lib/theme';

function describeNotification(n: AppNotification): string {
  switch (n.type) {
    case 'like':
      return 'liked your pump';
    case 'comment':
      return 'commented on your pump';
    case 'comment_reply':
      return 'replied to your comment';
    case 'follow':
      return 'started following you';
  }
}

export default function Notifications() {
  const { session } = useAuth();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!session?.user) return;
      getNotifications(session.user.id).then((page) => {
        setItems(page.items);
        setCursor(page.nextCursor);
        setLoading(false);
      });
      markAllRead(session.user.id);
    }, [session])
  );

  async function handleEndReached() {
    if (!session?.user || !cursor || loadingMore) return;
    setLoadingMore(true);
    const page = await getNotifications(session.user.id, cursor);
    setItems((prev) => [...prev, ...page.items]);
    setCursor(page.nextCursor);
    setLoadingMore(false);
  }

  function handlePress(n: AppNotification) {
    if (n.type === 'follow') {
      router.push(`/user/${n.actorId}` as Href);
    } else if (n.workoutId) {
      router.push({ pathname: '/workout/[id]', params: { id: n.workoutId } });
    }
  }

  return (
    <AnimatedScreen style={styles.container}>
      <View style={styles.backBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
      </View>
      {loading ? (
        <ActivityIndicator style={styles.loadingSpinner} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-outline" size={36} color={colors.textFaint} />
              <Text style={styles.emptyText}>No activity yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={[styles.row, !item.read && styles.rowUnread]} onPress={() => handlePress(item)}>
              {item.actorAvatar ? (
                <Image source={{ uri: item.actorAvatar }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" transition={200} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]} />
              )}
              <View style={styles.rowBody}>
                <Text style={styles.rowText}>
                  <Text style={styles.actorName}>{item.actorName}</Text> {describeNotification(item)}
                </Text>
                <Text style={styles.rowTime}>{formatRelativeTime(item.createdAt)}</Text>
              </View>
              <Ionicons
                name={
                  item.type === 'like'
                    ? 'heart'
                    : item.type === 'comment' || item.type === 'comment_reply'
                      ? 'chatbubble'
                      : 'person-add'
                }
                size={16}
                color={colors.textFaint}
              />
            </Pressable>
          )}
        />
      )}
    </AnimatedScreen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    backBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs, gap: spacing.lg },
    title: { ...typeScale.subtitle, color: colors.text },
    loadingSpinner: { marginTop: spacing.xxl },
    footerSpinner: { marginVertical: spacing.lg },
    list: { padding: spacing.lg },
    empty: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxl },
    emptyText: { ...typeScale.body, color: colors.textFaint },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    rowUnread: { backgroundColor: colors.surfaceRaised, borderRadius: radius.md, paddingHorizontal: spacing.sm },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    avatarPlaceholder: { backgroundColor: colors.surfaceRaised },
    rowBody: { flex: 1 },
    rowText: { ...typeScale.body, color: colors.textMuted },
    actorName: { color: colors.text, fontWeight: '700' },
    rowTime: { ...typeScale.caption, color: colors.textFaint, marginTop: 2 },
  });
}
