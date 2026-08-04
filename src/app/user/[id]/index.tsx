import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { getProfile, ProfileSummary } from '../../../lib/profile';
import { getUserPosts } from '../../../lib/feed';
import { formatRelativeTime } from '../../../lib/time';
import { getFollowStatus, follow, unfollow, FollowStatus } from '../../../lib/social-graph';
import { isBlocked, isMuted, blockUser, unblockUser, muteUser, unmuteUser, reportContent } from '../../../lib/moderation';
import { showAlert } from '../../../lib/alert';
import { AnimatedScreen } from '../../../components/AnimatedScreen';
import { ProfileHeaderSkeleton } from '../../../components/Skeleton';
import { PressableScale } from '../../../components/PressableScale';
import { colors, radius, spacing, type as typeScale, shadow } from '../../../lib/theme';

const REPORT_REASONS = ['Spam', 'Harassment', 'Inappropriate content', 'Impersonation', 'Other'];

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [followStatus, setFollowStatus] = useState<FollowStatus>('none');
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [mutedByMe, setMutedByMe] = useState(false);
  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);

  const isOwnProfile = session?.user?.id === id;

  const load = useCallback(async () => {
    if (!id || !session?.user) return;
    // getProfile and the follow/block/mute checks don't depend on each
    // other -- firing them together instead of awaiting getProfile first
    // cuts this screen's load to one round trip instead of two.
    const [loaded, relationship] = await Promise.all([
      getProfile(id, session.user.id),
      isOwnProfile
        ? Promise.resolve(null)
        : Promise.all([getFollowStatus(session.user.id, id), isBlocked(session.user.id, id), isMuted(session.user.id, id)]),
    ]);
    setProfile(loaded);
    setPostsCursor(loaded.recentWorkoutsNextCursor);
    if (relationship) {
      const [status, blocked, muted] = relationship;
      setFollowStatus(status);
      setBlockedByMe(blocked);
      setMutedByMe(muted);
    }
  }, [id, session, isOwnProfile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleLoadMorePosts() {
    if (!id || !session?.user || !postsCursor || loadingMorePosts) return;
    setLoadingMorePosts(true);
    const page = await getUserPosts(id, session.user.id, postsCursor);
    setProfile((prev) => (prev ? { ...prev, recentWorkouts: [...prev.recentWorkouts, ...page.posts] } : prev));
    setPostsCursor(page.nextCursor);
    setLoadingMorePosts(false);
  }

  async function handleToggleFollow() {
    if (!session?.user || !id) return;
    if (followStatus === 'none') {
      // Guess the outcome the server will almost certainly confirm (public
      // accounts accept immediately; private accounts start pending), show
      // that instantly, then reconcile if the guess was wrong.
      const optimisticStatus: FollowStatus = profile?.isPrivate ? 'pending' : 'accepted';
      setFollowStatus(optimisticStatus);
      setProfile((prev) => (prev && optimisticStatus === 'accepted' ? { ...prev, followerCount: prev.followerCount + 1 } : prev));
      try {
        const status = await follow(session.user.id, id);
        setFollowStatus(status);
        if (status !== optimisticStatus) {
          setProfile((prev) => {
            if (!prev) return prev;
            const delta = status === 'accepted' ? 1 : optimisticStatus === 'accepted' ? -1 : 0;
            return delta === 0 ? prev : { ...prev, followerCount: prev.followerCount + delta };
          });
        }
      } catch (e: any) {
        setFollowStatus('none');
        setProfile((prev) => (prev && optimisticStatus === 'accepted' ? { ...prev, followerCount: prev.followerCount - 1 } : prev));
        showAlert('Could not follow', e.message ?? String(e));
      }
    } else {
      const previousStatus = followStatus;
      const wasAccepted = previousStatus === 'accepted';
      setFollowStatus('none');
      setProfile((prev) => (prev && wasAccepted ? { ...prev, followerCount: prev.followerCount - 1 } : prev));
      try {
        await unfollow(session.user.id, id);
      } catch (e: any) {
        setFollowStatus(previousStatus);
        setProfile((prev) => (prev && wasAccepted ? { ...prev, followerCount: prev.followerCount + 1 } : prev));
        showAlert('Could not unfollow', e.message ?? String(e));
      }
    }
  }

  async function handleUnblock() {
    if (!session?.user || !id) return;
    setBlockedByMe(false);
    try {
      await unblockUser(session.user.id, id);
    } catch (e: any) {
      setBlockedByMe(true);
      showAlert('Could not unblock', e.message ?? String(e));
    }
  }

  function handleOpenMenu() {
    if (!session?.user || !id) return;
    Alert.alert('Options', undefined, [
      {
        text: blockedByMe ? 'Unblock' : 'Block',
        style: 'destructive',
        onPress: async () => {
          if (blockedByMe) {
            setBlockedByMe(false);
            try {
              await unblockUser(session.user.id, id);
            } catch (e: any) {
              setBlockedByMe(true);
              showAlert('Could not unblock', e.message ?? String(e));
            }
          } else {
            setBlockedByMe(true);
            setFollowStatus('none');
            try {
              await blockUser(session.user.id, id);
            } catch (e: any) {
              setBlockedByMe(false);
              showAlert('Could not block', e.message ?? String(e));
            }
          }
        },
      },
      {
        text: mutedByMe ? 'Unmute' : 'Mute',
        onPress: async () => {
          if (mutedByMe) {
            setMutedByMe(false);
            try {
              await unmuteUser(session.user.id, id);
            } catch (e: any) {
              setMutedByMe(true);
              showAlert('Could not unmute', e.message ?? String(e));
            }
          } else {
            setMutedByMe(true);
            try {
              await muteUser(session.user.id, id);
            } catch (e: any) {
              setMutedByMe(false);
              showAlert('Could not mute', e.message ?? String(e));
            }
          }
        },
      },
      { text: 'Report', onPress: handleOpenReport },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function handleOpenReport() {
    if (!session?.user || !id) return;
    Alert.alert(
      'Report this account',
      'Why are you reporting this account?',
      [
        ...REPORT_REASONS.map((reason) => ({
          text: reason,
          onPress: async () => {
            await reportContent({ reporterId: session.user.id, reportedUserId: id, reason });
            showAlert('Report submitted', "Thanks -- we'll take a look.");
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <ProfileHeaderSkeleton />
      </View>
    );
  }

  return (
    <AnimatedScreen style={styles.container}>
      <FlatList
        data={profile.recentWorkouts}
        keyExtractor={(item) => item.id}
        onEndReached={handleLoadMorePosts}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMorePosts ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null}
        renderItem={({ item }) => {
          const detail =
            item.title ??
            (item.sets.length > 0 ? `${item.sets.length} lift${item.sets.length > 1 ? 's' : ''} logged` : 'Pump post');
          return (
            <Pressable
              style={styles.workoutRow}
              onPress={() => router.push({ pathname: '/workout/[id]', params: { id: item.id } })}
            >
              <Text style={styles.workoutDetail}>{detail}</Text>
              <Text style={styles.workoutTime}>{formatRelativeTime(item.created_at)}</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyPosts}>
            {isOwnProfile
              ? 'No posts yet.'
              : profile.isPrivate && followStatus !== 'accepted'
                ? 'This account is private. Follow to see their posts.'
                : "Follow to see this lifter's posts."}
          </Text>
        }
        ListHeaderComponent={
          <View>
            <View style={styles.backBar}>
              <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
                <Ionicons name="chevron-back" size={22} color={colors.primary} />
              </Pressable>
              {!isOwnProfile && (
                <Pressable onPress={handleOpenMenu} hitSlop={12} accessibilityRole="button" accessibilityLabel="More options">
                  <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
                </Pressable>
              )}
            </View>
            <View style={styles.header}>
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]} />
              )}
              <Text style={styles.name}>{profile.display_name}</Text>
              <Text style={profile.bio ? styles.bio : styles.bioEmpty}>{profile.bio ?? 'No bio yet'}</Text>
              {(profile.gym || profile.favoriteLift || profile.yearsLifting != null) && (
                <View style={styles.statsRow}>
                  {profile.gym && (
                    <View style={styles.statItem}>
                      <Ionicons name="business-outline" size={13} color={colors.textFaint} />
                      <Text style={styles.statText}>{profile.gym}</Text>
                    </View>
                  )}
                  {profile.favoriteLift && (
                    <View style={styles.statItem}>
                      <Ionicons name="barbell-outline" size={13} color={colors.textFaint} />
                      <Text style={styles.statText}>{profile.favoriteLift}</Text>
                    </View>
                  )}
                  {profile.yearsLifting != null && (
                    <View style={styles.statItem}>
                      <Ionicons name="calendar-outline" size={13} color={colors.textFaint} />
                      <Text style={styles.statText}>{profile.yearsLifting} yr{profile.yearsLifting === 1 ? '' : 's'}</Text>
                    </View>
                  )}
                </View>
              )}
              {profile.traits.length > 0 && (
                <View style={styles.traitRow}>
                  {profile.traits.map((trait) => (
                    <View key={trait} style={styles.traitChip}>
                      <Text style={styles.traitChipText}>{trait}</Text>
                    </View>
                  ))}
                </View>
              )}
              {profile.badges.length > 0 && (
                <View style={styles.traitRow}>
                  {profile.badges.map((badge) => (
                    <View key={badge.id} style={styles.badgeChip}>
                      <Ionicons name={badge.icon} size={12} color={colors.gold} />
                      <Text style={styles.badgeChipText}>{badge.label}</Text>
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
                {profile.streak > 0 && (
                  <>
                    <Text style={styles.counts}> · </Text>
                    <View style={styles.streakItem}>
                      <Ionicons name="flame" size={14} color={colors.accent} />
                      <Text style={styles.counts}>{profile.streak} day streak</Text>
                    </View>
                  </>
                )}
              </View>
              {!isOwnProfile &&
                (blockedByMe ? (
                  <PressableScale style={[styles.followButton, styles.blockedButton]} onPress={handleUnblock}>
                    <Text style={styles.followButtonText}>Blocked · Tap to Unblock</Text>
                  </PressableScale>
                ) : (
                  <PressableScale
                    style={[styles.followButton, followStatus !== 'none' && styles.followButtonActive]}
                    onPress={handleToggleFollow}
                    scaleTo={0.96}
                  >
                    <Text style={[styles.followButtonText, followStatus !== 'none' && styles.followButtonTextActive]}>
                      {followStatus === 'accepted' ? 'Unfollow' : followStatus === 'pending' ? 'Requested' : 'Follow'}
                    </Text>
                  </PressableScale>
                ))}
            </View>

            {profile.prList.length > 0 && (
              <View style={styles.bestLiftCard}>
                <View style={styles.bestLiftHeader}>
                  <Ionicons name="trophy" size={14} color={colors.gold} />
                  <Text style={styles.bestLiftLabel}>Best Lift</Text>
                </View>
                <Text style={styles.bestLiftExercise}>{profile.prList[0].exercise_name}</Text>
                <Text style={styles.bestLiftValue}>
                  {profile.prList[0].weight} x {profile.prList[0].reps}
                </Text>
                <Text style={styles.bestLiftEst}>Est. 1RM {Math.round(profile.prList[0].estimated_1rm)}</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Personal Records</Text>
            <FlatList
              data={profile.prList}
              keyExtractor={(item) => item.exercise_name}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.prList}
              ListEmptyComponent={<Text style={styles.emptyInline}>No PRs logged yet</Text>}
              renderItem={({ item }) => (
                <View style={styles.prCard}>
                  <Ionicons name="trophy" size={14} color={colors.gold} style={styles.prIcon} />
                  <Text style={styles.prExercise}>{item.exercise_name}</Text>
                  <Text style={styles.prValue}>
                    {item.weight} x {item.reps}
                  </Text>
                </View>
              )}
            />

            <Text style={styles.sectionTitle}>Recent Posts</Text>
          </View>
        }
      />
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  backBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  footerSpinner: { marginVertical: spacing.lg },
  header: { alignItems: 'center', marginBottom: spacing.xl, paddingHorizontal: spacing.lg },
  avatar: { width: 84, height: 84, borderRadius: 42 },
  avatarPlaceholder: { backgroundColor: colors.surfaceRaised },
  name: { ...typeScale.title, color: colors.text, marginTop: spacing.sm },
  bio: { ...typeScale.body, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  bioEmpty: { ...typeScale.body, color: colors.textFaint, marginTop: spacing.xs, fontStyle: 'italic' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md, marginTop: spacing.sm },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { ...typeScale.caption, color: colors.textFaint },
  traitRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm },
  traitChip: { backgroundColor: colors.surfaceRaised, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  traitChipText: { ...typeScale.micro, color: colors.textMuted },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeChipText: { ...typeScale.micro, color: colors.primary },
  countsRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  counts: { ...typeScale.body, color: colors.textMuted },
  streakItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  followButton: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radius.sm, marginTop: spacing.md },
  followButtonActive: { backgroundColor: colors.surfaceRaised },
  blockedButton: { backgroundColor: colors.danger },
  followButtonText: { ...typeScale.caption, color: colors.white, fontWeight: '700' },
  followButtonTextActive: { color: colors.textMuted },
  bestLiftCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
    ...shadow.card,
  },
  bestLiftHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xs },
  bestLiftLabel: { ...typeScale.micro, color: colors.gold, textTransform: 'uppercase', letterSpacing: 0.5 },
  bestLiftExercise: { ...typeScale.subtitle, color: colors.text },
  bestLiftValue: { ...typeScale.display, color: colors.text, marginTop: spacing.xs },
  bestLiftEst: { ...typeScale.caption, color: colors.textMuted, marginTop: spacing.xs },
  sectionTitle: { ...typeScale.subtitle, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm, paddingHorizontal: spacing.lg },
  emptyInline: { ...typeScale.caption, color: colors.textFaint, fontStyle: 'italic', paddingHorizontal: spacing.lg },
  prList: { gap: spacing.sm, paddingLeft: spacing.lg },
  prCard: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, marginRight: spacing.sm, ...shadow.raised },
  prIcon: { marginBottom: spacing.xs },
  prExercise: { ...typeScale.caption, color: colors.text, fontWeight: '700' },
  prValue: { ...typeScale.caption, color: colors.textMuted, marginTop: spacing.xs },
  workoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  workoutDetail: { ...typeScale.body, color: colors.text },
  workoutTime: { ...typeScale.caption, color: colors.textFaint },
  emptyPosts: { ...typeScale.caption, color: colors.textFaint, paddingHorizontal: spacing.lg, fontStyle: 'italic' },
});
