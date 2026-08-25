import React, { useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withDelay, Easing, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { FeedPost } from '../lib/feed';
import { formatRelativeTime } from '../lib/time';
import { PhotoCarousel } from './PhotoCarousel';
import { PressableScale } from './PressableScale';
import { useReducedMotion } from '../lib/useReducedMotion';
import { useThemeColors, radius, spacing, type as typeScale, shadow, ThemeColors } from '../lib/theme';

const DOUBLE_TAP_MS = 280;
// Stagger only the first screenful -- beyond that the delay would just make
// later cards feel like they're lagging in, not entering with intent.
const STAGGER_CAP = 8;
const STAGGER_STEP_MS = 40;

interface FeedCardProps {
  post: FeedPost;
  index?: number;
  onOpen: () => void;
  onOpenUser: () => void;
  onToggleLike: () => void;
  onToggleBookmark: () => void;
}

export function FeedCard({ post, index = STAGGER_CAP, onOpen, onOpenUser, onToggleLike, onToggleBookmark }: FeedCardProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reducedMotion = useReducedMotion();
  const lastTap = useRef(0);
  const pendingTap = useRef<ReturnType<typeof setTimeout> | null>(null);

  const burstScale = useSharedValue(0);
  const burstOpacity = useSharedValue(0);
  const burstStyle = useAnimatedStyle(() => ({
    opacity: burstOpacity.value,
    transform: [{ scale: burstScale.value }],
  }));

  function playBurst() {
    if (reducedMotion) return;
    burstScale.value = 0.6;
    burstOpacity.value = 1;
    burstScale.value = withSequence(
      withTiming(1.15, { duration: 160, easing: Easing.out(Easing.back(1.5)) }),
      withTiming(1, { duration: 100 })
    );
    burstOpacity.value = withDelay(350, withTiming(0, { duration: 250 }));
  }

  async function handleShare() {
    try {
      await Share.share({
        message: `${post.display_name} on Pump Dump${post.caption ? `: ${post.caption}` : ''}\nlifterapp://workout/${post.id}`,
      });
    } catch {
      // user dismissed the share sheet -- nothing to handle
    }
  }

  function handlePhotoPress() {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      if (pendingTap.current) {
        clearTimeout(pendingTap.current);
        pendingTap.current = null;
      }
      playBurst();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (!post.likedByMe) onToggleLike();
      return;
    }
    lastTap.current = now;
    pendingTap.current = setTimeout(() => {
      pendingTap.current = null;
      onOpen();
    }, DOUBLE_TAP_MS);
  }

  return (
    <Animated.View
      style={styles.cardWrapper}
      entering={
        reducedMotion
          ? undefined
          : FadeInDown.delay(Math.min(index, STAGGER_CAP) * STAGGER_STEP_MS).duration(280).springify().damping(18)
      }
    >
    <Pressable style={styles.card} onPress={onOpen}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Pressable onPress={onOpenUser} hitSlop={8}>
            <Text style={styles.name}>{post.display_name}</Text>
          </Pressable>
          {post.title && (
            <View style={styles.groupPill}>
              <Text style={styles.groupPillText}>{post.title}</Text>
            </View>
          )}
        </View>
        {post.hasPR && (
          <View style={styles.prBadge}>
            <Ionicons name="trophy" size={12} color={colors.black} />
            <Text style={styles.prBadgeText}>New PR</Text>
          </View>
        )}
      </View>

      {post.gymName && (
        <View style={styles.gymRow}>
          <Ionicons name="location" size={11} color={colors.textFaint} />
          <Text style={styles.gymText}>{post.gymName}</Text>
        </View>
      )}

      {post.photos.length === 1 ? (
        <Pressable onPress={handlePhotoPress}>
          <PhotoCarousel photos={post.photos} height={260} style={styles.photo} />
          <Animated.View style={[styles.burst, burstStyle]} pointerEvents="none">
            <Ionicons name="heart" size={84} color={colors.white} />
          </Animated.View>
        </Pressable>
      ) : post.photos.length > 1 ? (
        <PhotoCarousel photos={post.photos} height={260} style={styles.photo} />
      ) : null}

      {post.caption && <Text style={styles.caption}>{post.caption}</Text>}
      {post.sets.slice(0, 3).map((s, i) => (
        <Text key={i} style={styles.setLine}>
          {s.exercise_name}: {s.weight}
          {s.unit} x {s.reps}
        </Text>
      ))}
      {post.sets.length > 3 && <Text style={styles.more}>+{post.sets.length - 3} more sets</Text>}

      <View style={styles.metaRow}>
        <View style={styles.metaLeft}>
          <PressableScale
            style={styles.metaItem}
            onPress={onToggleLike}
            hitSlop={8}
            scaleTo={0.85}
            accessibilityRole="button"
            accessibilityLabel={post.likedByMe ? 'Unlike' : 'Like'}
          >
            <Ionicons
              name={post.likedByMe ? 'heart' : 'heart-outline'}
              size={16}
              color={post.likedByMe ? colors.accent : colors.textFaint}
            />
            <Text style={styles.meta}>{post.likeCount}</Text>
          </PressableScale>
          <Pressable
            style={styles.metaItem}
            onPress={onOpen}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`View comments, ${post.commentCount}`}
          >
            <Ionicons name="chatbubble" size={13} color={colors.textFaint} />
            <Text style={styles.meta}>{post.commentCount}</Text>
          </Pressable>
        </View>
        <View style={styles.metaRight}>
          <Text style={styles.metaTime}>{formatRelativeTime(post.created_at)}</Text>
          <PressableScale
            onPress={onToggleBookmark}
            hitSlop={8}
            scaleTo={0.85}
            accessibilityRole="button"
            accessibilityLabel={post.bookmarkedByMe ? 'Remove from saved' : 'Save post'}
          >
            <Ionicons
              name={post.bookmarkedByMe ? 'bookmark' : 'bookmark-outline'}
              size={16}
              color={post.bookmarkedByMe ? colors.primary : colors.textFaint}
            />
          </PressableScale>
          <PressableScale
            onPress={handleShare}
            hitSlop={8}
            scaleTo={0.85}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel="Share post"
          >
            <Ionicons name="share-outline" size={17} color={colors.textFaint} />
          </PressableScale>
        </View>
      </View>

      {post.latestComment && (
        <Pressable onPress={onOpen}>
          <Text style={styles.commentPreview} numberOfLines={1}>
            <Text style={styles.commentPreviewAuthor}>{post.latestComment.display_name} </Text>
            {post.latestComment.body}
          </Text>
          {post.commentCount > 1 && (
            <Text style={styles.viewAllComments}>View all {post.commentCount} comments</Text>
          )}
        </Pressable>
      )}
    </Pressable>
    </Animated.View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    cardWrapper: { margin: spacing.md },
    card: {
      padding: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      ...shadow.card,
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
    name: { ...typeScale.subtitle, color: colors.text },
    groupPill: { backgroundColor: colors.primaryMuted, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
    groupPillText: { ...typeScale.micro, color: colors.primary },
    prBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.gold,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.sm,
    },
    prBadgeText: { ...typeScale.micro, color: colors.black },
    photo: { width: '100%', height: 260, borderRadius: radius.md, marginTop: spacing.md },
    gymRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    gymText: { ...typeScale.micro, color: colors.textFaint },
    burst: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      marginTop: spacing.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    caption: { ...typeScale.body, color: colors.text, marginTop: spacing.md },
    setLine: { ...typeScale.caption, color: colors.textMuted, marginTop: spacing.xs },
    more: { ...typeScale.caption, color: colors.textFaint, marginTop: spacing.xs },
    metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
    metaLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    metaRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    meta: { ...typeScale.caption, color: colors.textFaint },
    metaTime: { ...typeScale.caption, color: colors.textFaint },
    commentPreview: { ...typeScale.caption, color: colors.textMuted, marginTop: spacing.sm },
    commentPreviewAuthor: { fontWeight: '700', color: colors.text },
    viewAllComments: { ...typeScale.micro, color: colors.textFaint, marginTop: 2 },
  });
}
