import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useFocusEffect, router, Href } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { getWorkoutDetail, WorkoutDetail, toggleLike, getComments, addComment, Comment } from '../../lib/social';
import { toggleBookmark } from '../../lib/bookmarks';
import { deleteWorkout } from '../../lib/workouts';
import { reportContent } from '../../lib/moderation';
import { showAlert } from '../../lib/alert';
import { formatRelativeTime } from '../../lib/time';
import { AnimatedScreen } from '../../components/AnimatedScreen';
import { PhotoCarousel } from '../../components/PhotoCarousel';
import { useThemeColors, radius, spacing, type as typeScale, ThemeColors } from '../../lib/theme';

const REPORT_REASONS = ['Spam', 'Harassment', 'Inappropriate content', 'Impersonation', 'Other'];

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [detail, setDetail] = useState<WorkoutDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const listRef = useRef<FlatList>(null);

  // KeyboardAvoidingView's padding math is calibrated for the regular
  // keyboard; switching to the emoji keyboard (taller, with its category
  // strip) can still leave the input riding under it since the comment box
  // sits at the very bottom of a long FlatList. Scrolling to the end on
  // focus, regardless of which keyboard opens, guarantees the input clears
  // whatever comes up rather than relying on a fixed offset.
  function handleCommentFocus() {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }

  const load = useCallback(async () => {
    if (!session?.user || !id) return;
    const [workoutDetail, workoutComments] = await Promise.all([getWorkoutDetail(id, session.user.id), getComments(id)]);
    setDetail(workoutDetail);
    setComments(workoutComments);
  }, [id, session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleToggleLike() {
    if (!session?.user || !detail) return;
    await toggleLike(session.user.id, detail.id, detail.likedByMe);
    setDetail({
      ...detail,
      likedByMe: !detail.likedByMe,
      likeCount: detail.likedByMe ? detail.likeCount - 1 : detail.likeCount + 1,
    });
  }

  async function handleToggleBookmark() {
    if (!session?.user || !detail) return;
    const currentlyBookmarked = detail.bookmarkedByMe;
    setDetail({ ...detail, bookmarkedByMe: !currentlyBookmarked });
    try {
      await toggleBookmark(session.user.id, detail.id, currentlyBookmarked);
    } catch {
      setDetail((prev) => (prev ? { ...prev, bookmarkedByMe: currentlyBookmarked } : prev));
    }
  }

  async function handleShare() {
    if (!detail) return;
    try {
      await Share.share({
        message: `${detail.display_name} on Pump Dump${detail.caption ? `: ${detail.caption}` : ''}\nlifterapp://workout/${detail.id}`,
      });
    } catch {
      // user dismissed the share sheet
    }
  }

  function handleDelete() {
    if (!detail) return;
    Alert.alert('Delete post', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await deleteWorkout(detail.id, detail.photos);
            router.back();
          } catch (e: any) {
            showAlert('Could not delete post', e.message ?? String(e));
          }
        },
      },
    ]);
  }

  function handleReport() {
    if (!session?.user || !detail) return;
    Alert.alert(
      'Report this post',
      'Why are you reporting this post?',
      [
        ...REPORT_REASONS.map((reason) => ({
          text: reason,
          onPress: async () => {
            await reportContent({ reporterId: session.user.id, workoutId: detail.id, reason });
            showAlert('Report submitted', "Thanks -- we'll take a look.");
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  }

  async function handleAddComment() {
    if (!session?.user || !detail || commentText.trim().length === 0) return;
    const body = commentText.trim();
    const tempId = `temp-${Date.now()}`;
    // "You" is a placeholder, not a guess at the real display name -- the
    // optimistic row only lives on screen for the moment before the insert
    // resolves and swaps in the server's version (with the real name).
    setComments((prev) => [...prev, { id: tempId, user_id: session.user.id, display_name: 'You', body, created_at: new Date().toISOString() }]);
    setCommentText('');
    try {
      const created = await addComment(session.user.id, detail.id, body);
      setComments((prev) => prev.map((c) => (c.id === tempId ? created : c)));
    } catch (e: any) {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      showAlert('Could not post comment', e.message ?? String(e));
    }
  }

  if (!detail) {
    return (
      <AnimatedScreen style={styles.container}>
        <ActivityIndicator style={styles.loadingSpinner} color={colors.primary} />
      </AnimatedScreen>
    );
  }

  return (
    <AnimatedScreen style={styles.container}>
      <View style={styles.backBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </Pressable>
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
      <FlatList
        ref={listRef}
        style={styles.flex}
        data={detail.sets}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Pressable
                onPress={() => router.push(`/user/${detail.user_id}` as Href)}
                accessibilityRole="button"
                accessibilityLabel={`View ${detail.display_name}'s profile`}
              >
                <Text style={styles.name}>{detail.display_name}</Text>
                <Text style={styles.time}>{formatRelativeTime(detail.created_at)}</Text>
                {detail.gymName && (
                  <View style={styles.gymRow}>
                    <Ionicons name="location" size={11} color={colors.textFaint} />
                    <Text style={styles.gymText}>{detail.gymName}</Text>
                  </View>
                )}
              </Pressable>
              <View style={styles.headerActions}>
                <Pressable
                  onPress={handleToggleLike}
                  hitSlop={8}
                  style={styles.likeButton}
                  accessibilityRole="button"
                  accessibilityLabel={detail.likedByMe ? 'Unlike' : 'Like'}
                >
                  <Ionicons
                    name={detail.likedByMe ? 'heart' : 'heart-outline'}
                    size={22}
                    color={detail.likedByMe ? colors.accent : colors.textMuted}
                  />
                  <Text style={styles.likeCount}>{detail.likeCount}</Text>
                </Pressable>
                <Pressable
                  onPress={handleToggleBookmark}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={detail.bookmarkedByMe ? 'Remove from saved' : 'Save post'}
                >
                  <Ionicons
                    name={detail.bookmarkedByMe ? 'bookmark' : 'bookmark-outline'}
                    size={22}
                    color={detail.bookmarkedByMe ? colors.primary : colors.textMuted}
                  />
                </Pressable>
                <Pressable onPress={handleShare} hitSlop={8} accessibilityRole="button" accessibilityLabel="Share post">
                  <Ionicons name="share-outline" size={22} color={colors.textMuted} />
                </Pressable>
                {detail.user_id === session?.user?.id ? (
                  <Pressable onPress={handleDelete} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete post">
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </Pressable>
                ) : (
                  <Pressable onPress={handleReport} hitSlop={8} accessibilityRole="button" accessibilityLabel="Report post">
                    <Ionicons name="flag-outline" size={20} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>
            </View>
            {detail.title && (
              <View style={styles.groupPill}>
                <Text style={styles.groupPillText}>{detail.title}</Text>
              </View>
            )}
            {detail.photos.length > 0 && (
              <PhotoCarousel photos={detail.photos} height={320} style={styles.photo} edgeInset={spacing.lg} />
            )}
            {detail.caption && <Text style={styles.caption}>{detail.caption}</Text>}
            {detail.sets.length > 0 && <Text style={styles.liftsHeading}>Lifts</Text>}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.setRow}>
            <Text style={styles.setLine}>
              {item.exercise_name}: {item.weight}
              {item.unit} x {item.reps}
            </Text>
            {item.isPR && (
              <View style={styles.prBadge}>
                <Ionicons name="trophy" size={11} color={colors.black} />
                <Text style={styles.prBadgeText}>PR</Text>
              </View>
            )}
          </View>
        )}
        ListFooterComponent={
          <View style={styles.comments}>
            <Text style={styles.commentsTitle}>Comments</Text>
            {comments.length === 0 && <Text style={styles.emptyComments}>No comments yet. Say something.</Text>}
            {comments.map((c) => (
              <View key={c.id} style={styles.commentRow}>
                <Text style={styles.comment}>
                  <Text style={styles.commentAuthor}>{c.display_name}: </Text>
                  {c.body}
                </Text>
                <Text style={styles.commentTime}>{formatRelativeTime(c.created_at)}</Text>
              </View>
            ))}
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor={colors.textFaint}
                value={commentText}
                onChangeText={setCommentText}
                onFocus={handleCommentFocus}
                accessibilityLabel="Add a comment"
              />
              <Pressable onPress={handleAddComment} hitSlop={8}>
                <Text style={styles.postButton}>Post</Text>
              </Pressable>
            </View>
          </View>
        }
      />
      </KeyboardAvoidingView>
    </AnimatedScreen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    loadingSpinner: { marginTop: spacing.xxl },
    backBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
    listContent: { padding: spacing.lg },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
    name: { ...typeScale.title, color: colors.text },
    time: { ...typeScale.caption, color: colors.textFaint, marginTop: 2 },
    gymRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    gymText: { ...typeScale.micro, color: colors.textFaint },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    likeButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    likeCount: { ...typeScale.body, color: colors.textMuted },
    groupPill: {
      alignSelf: 'flex-start',
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.pill,
      marginBottom: spacing.sm,
    },
    groupPillText: { ...typeScale.micro, color: colors.primary },
    photo: { width: '100%', height: 320, borderRadius: radius.md, marginBottom: spacing.md },
    caption: { ...typeScale.body, color: colors.text, marginBottom: spacing.md },
    liftsHeading: { ...typeScale.subtitle, color: colors.text, marginBottom: spacing.xs },
    setRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border },
    setLine: { ...typeScale.body, color: colors.textMuted },
    prBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.gold, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
    prBadgeText: { ...typeScale.micro, color: colors.black },
    comments: { marginTop: spacing.xl },
    commentsTitle: { ...typeScale.subtitle, color: colors.text, marginBottom: spacing.sm },
    emptyComments: { ...typeScale.caption, color: colors.textFaint, fontStyle: 'italic', marginBottom: spacing.sm },
    commentRow: { paddingVertical: spacing.xs },
    comment: { ...typeScale.body, color: colors.text },
    commentAuthor: { fontWeight: '700' },
    commentTime: { ...typeScale.micro, color: colors.textFaint, marginTop: 2 },
    commentInputRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, alignItems: 'center' },
    commentInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.text,
      borderRadius: radius.md,
      padding: spacing.sm + 2,
    },
    postButton: { color: colors.primary, fontWeight: '700' },
  });
}
