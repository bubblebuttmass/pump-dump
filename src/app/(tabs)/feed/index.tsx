import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router, Href } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { getFeed, FeedPost, FEED_PAGE_SIZE } from '../../../lib/feed';
import { toggleLike } from '../../../lib/social';
import { toggleBookmark } from '../../../lib/bookmarks';
import { getUnreadCount } from '../../../lib/notifications';
import { AnimatedScreen } from '../../../components/AnimatedScreen';
import { FeedCardSkeleton } from '../../../components/Skeleton';
import { FeedCard } from '../../../components/FeedCard';
import { useThemeColors, spacing, type as typeScale, ThemeColors } from '../../../lib/theme';

export default function Feed() {
  const { session } = useAuth();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadFirstPage = useCallback(async () => {
    if (!session?.user) return;
    const page = await getFeed(session.user.id);
    setPosts(page.posts);
    setCursor(page.nextCursor);
    setInitialLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      loadFirstPage();
      if (session?.user) getUnreadCount(session.user.id).then(setUnreadCount);
    }, [loadFirstPage, session])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadFirstPage();
    setRefreshing(false);
  }

  async function handleEndReached() {
    if (!session?.user || !cursor || loadingMore) return;
    setLoadingMore(true);
    const page = await getFeed(session.user.id, cursor);
    setPosts((prev) => [...prev, ...page.posts]);
    setCursor(page.nextCursor);
    setLoadingMore(false);
  }

  async function handleToggleLike(postId: string, currentlyLiked: boolean) {
    if (!session?.user) return;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, likedByMe: !currentlyLiked, likeCount: currentlyLiked ? p.likeCount - 1 : p.likeCount + 1 }
          : p
      )
    );
    try {
      await toggleLike(session.user.id, postId, currentlyLiked);
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, likedByMe: currentlyLiked, likeCount: currentlyLiked ? p.likeCount + 1 : p.likeCount - 1 }
            : p
        )
      );
    }
  }

  async function handleToggleBookmark(postId: string, currentlyBookmarked: boolean) {
    if (!session?.user) return;
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, bookmarkedByMe: !currentlyBookmarked } : p)));
    try {
      await toggleBookmark(session.user.id, postId, currentlyBookmarked);
    } catch {
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, bookmarkedByMe: currentlyBookmarked } : p)));
    }
  }

  if (initialLoading) {
    return (
      <AnimatedScreen style={styles.container}>
        {[0, 1, 2].map((i) => (
          <FeedCardSkeleton key={i} />
        ))}
      </AnimatedScreen>
    );
  }

  return (
    <AnimatedScreen style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>Pump Dump</Text>
        <Pressable
          onPress={() => router.push('/notifications')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        >
          <Ionicons name="notifications-outline" size={24} color={colors.text} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </View>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        initialNumToRender={FEED_PAGE_SIZE}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="barbell-outline" size={40} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>Your feed is empty</Text>
            <Text style={styles.emptyBody}>Follow lifters in Search to fill it up.</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <FeedCard
            post={item}
            index={index}
            onOpen={() => router.push({ pathname: '/workout/[id]', params: { id: item.id } })}
            onOpenUser={() => router.push(`/user/${item.user_id}` as Href)}
            onToggleLike={() => handleToggleLike(item.id, item.likedByMe)}
            onToggleBookmark={() => handleToggleBookmark(item.id, item.bookmarkedByMe)}
          />
        )}
      />
    </AnimatedScreen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    brand: { ...typeScale.title, color: colors.text },
    badge: {
      position: 'absolute',
      top: -4,
      right: -6,
      backgroundColor: colors.accent,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      paddingHorizontal: 3,
      justifyContent: 'center',
      alignItems: 'center',
    },
    badgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
    empty: { padding: spacing.xxl, alignItems: 'center', gap: spacing.xs },
    emptyTitle: { ...typeScale.subtitle, color: colors.text, marginTop: spacing.sm },
    emptyBody: { ...typeScale.body, color: colors.textMuted },
    footerSpinner: { marginVertical: spacing.xl },
  });
}
