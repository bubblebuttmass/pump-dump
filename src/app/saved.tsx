import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, Href } from 'expo-router';
import { useAuth } from '../lib/auth';
import { FeedPost } from '../lib/feed';
import { getBookmarkedPosts, toggleBookmark } from '../lib/bookmarks';
import { toggleLike } from '../lib/social';
import { AnimatedScreen } from '../components/AnimatedScreen';
import { FeedCard } from '../components/FeedCard';
import { colors, spacing, type as typeScale } from '../lib/theme';

export default function Saved() {
  const { session } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!session?.user) return;
      getBookmarkedPosts(session.user.id).then((page) => {
        setPosts(page.posts);
        setCursor(page.nextCursor);
        setLoading(false);
      });
    }, [session])
  );

  async function handleEndReached() {
    if (!session?.user || !cursor || loadingMore) return;
    setLoadingMore(true);
    const page = await getBookmarkedPosts(session.user.id, cursor);
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

  // Unsaving here removes the post from this list immediately -- unlike
  // Feed's optimistic update, there's no "undo" state to roll back to since
  // the row simply wouldn't belong in a Saved list anymore once toggled off.
  async function handleToggleBookmark(postId: string) {
    if (!session?.user) return;
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      await toggleBookmark(session.user.id, postId, true);
    } catch {
      // Failed to unsave -- reload so state stays truthful rather than
      // silently hiding a post that's still bookmarked server-side.
      const page = await getBookmarkedPosts(session.user.id);
      setPosts(page.posts);
      setCursor(page.nextCursor);
    }
  }

  return (
    <AnimatedScreen style={styles.container}>
      <View style={styles.backBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </Pressable>
        <Text style={styles.title}>Saved</Text>
      </View>
      {loading ? (
        <ActivityIndicator style={styles.loadingSpinner} color={colors.primary} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="bookmark-outline" size={36} color={colors.textFaint} />
              <Text style={styles.emptyText}>Posts you save will show up here</Text>
            </View>
          }
          renderItem={({ item }) => (
            <FeedCard
              post={item}
              onOpen={() => router.push({ pathname: '/workout/[id]', params: { id: item.id } })}
              onOpenUser={() => router.push(`/user/${item.user_id}` as Href)}
              onToggleLike={() => handleToggleLike(item.id, item.likedByMe)}
              onToggleBookmark={() => handleToggleBookmark(item.id)}
            />
          )}
        />
      )}
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  backBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs, gap: spacing.lg },
  title: { ...typeScale.subtitle, color: colors.text },
  loadingSpinner: { marginTop: spacing.xxl },
  footerSpinner: { marginVertical: spacing.lg },
  empty: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyText: { ...typeScale.body, color: colors.textFaint, textAlign: 'center' },
});
