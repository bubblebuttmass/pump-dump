import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { getProfile, ProfileSummary, getWeeklyRecap, WeeklyRecap } from '../../../lib/profile';
import { getUserPosts } from '../../../lib/feed';
import { formatRelativeTime } from '../../../lib/time';
import { AnimatedScreen } from '../../../components/AnimatedScreen';
import { ProfileHeaderSkeleton } from '../../../components/Skeleton';
import { colors, radius, spacing, type as typeScale, shadow } from '../../../lib/theme';

export default function Profile() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [weeklyRecap, setWeeklyRecap] = useState<WeeklyRecap | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (session?.user) {
        getProfile(session.user.id, session.user.id).then((loaded) => {
          setProfile(loaded);
          setPostsCursor(loaded.recentWorkoutsNextCursor);
        });
        getWeeklyRecap(session.user.id).then(setWeeklyRecap);
      }
    }, [session])
  );

  const completionChecks = profile
    ? [
        !!profile.avatar_url,
        !!profile.bio,
        !!(profile.gym || profile.favoriteLift || profile.yearsLifting != null),
        profile.traits.length > 0,
        profile.workoutCount > 0,
      ]
    : [];
  const completionPercent = completionChecks.length > 0
    ? Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100)
    : 100;

  async function handleLoadMorePosts() {
    if (!session?.user || !postsCursor || loadingMorePosts) return;
    setLoadingMorePosts(true);
    const page = await getUserPosts(session.user.id, session.user.id, postsCursor);
    setProfile((prev) => (prev ? { ...prev, recentWorkouts: [...prev.recentWorkouts, ...page.posts] } : prev));
    setPostsCursor(page.nextCursor);
    setLoadingMorePosts(false);
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ProfileHeaderSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <AnimatedScreen style={styles.container} edges={['top']}>
      <FlatList
        data={profile.recentWorkouts}
        keyExtractor={(item) => item.id}
        onEndReached={handleLoadMorePosts}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={loadingMorePosts ? <ActivityIndicator style={styles.footerSpinner} color={colors.primary} /> : null}
        ListEmptyComponent={<Text style={styles.emptyInline}>No posts yet.</Text>}
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
        ListHeaderComponent={
          <View>
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
                <Pressable
                  onPress={() => session?.user && router.push({ pathname: '/user/[id]/followers', params: { id: session.user.id } })}
                >
                  <Text style={styles.counts}>{profile.followerCount} followers</Text>
                </Pressable>
                <Text style={styles.counts}> · </Text>
                <Pressable
                  onPress={() => session?.user && router.push({ pathname: '/user/[id]/following', params: { id: session.user.id } })}
                >
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
              <View style={styles.headerActions}>
                <Pressable style={styles.editButton} onPress={() => router.push('/(tabs)/profile/edit')}>
                  <Text style={styles.editButtonText}>Edit Profile</Text>
                </Pressable>
                <Pressable onPress={() => router.push('/saved')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Saved posts">
                  <Ionicons name="bookmark-outline" size={20} color={colors.textMuted} />
                </Pressable>
                <Pressable onPress={() => router.push('/settings')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Settings">
                  <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>

            {completionPercent < 100 && (
              <Pressable style={styles.completionCard} onPress={() => router.push('/(tabs)/profile/edit')}>
                <View style={styles.completionHeader}>
                  <Text style={styles.completionLabel}>Complete your profile</Text>
                  <Text style={styles.completionPercent}>{completionPercent}%</Text>
                </View>
                <View style={styles.completionTrack}>
                  <View style={[styles.completionFill, { width: `${completionPercent}%` }]} />
                </View>
              </Pressable>
            )}

            {weeklyRecap && (weeklyRecap.workoutsThisWeek > 0 || weeklyRecap.prsThisWeek > 0) && (
              <View style={styles.recapCard}>
                <Text style={styles.recapTitle}>This Week</Text>
                <View style={styles.recapRow}>
                  <View style={styles.recapStat}>
                    <Text style={styles.recapNumber}>{weeklyRecap.workoutsThisWeek}</Text>
                    <Text style={styles.recapStatLabel}>Pumps</Text>
                  </View>
                  <View style={styles.recapStat}>
                    <Text style={styles.recapNumber}>{weeklyRecap.prsThisWeek}</Text>
                    <Text style={styles.recapStatLabel}>New PRs</Text>
                  </View>
                </View>
              </View>
            )}

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
  listContent: { padding: spacing.lg },
  footerSpinner: { marginVertical: spacing.lg },
  header: { alignItems: 'center', marginBottom: spacing.xl },
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.md },
  editButton: { backgroundColor: colors.surfaceRaised, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.sm },
  editButtonText: { ...typeScale.caption, color: colors.text },
  completionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  completionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  completionLabel: { ...typeScale.caption, color: colors.textMuted, fontWeight: '700' },
  completionPercent: { ...typeScale.caption, color: colors.primary, fontWeight: '700' },
  completionTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  completionFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  recapCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  recapTitle: { ...typeScale.caption, color: colors.textMuted, fontWeight: '700', marginBottom: spacing.sm },
  recapRow: { flexDirection: 'row', gap: spacing.xl },
  recapStat: { alignItems: 'center' },
  recapNumber: { ...typeScale.title, color: colors.text },
  recapStatLabel: { ...typeScale.micro, color: colors.textFaint, marginTop: 2 },
  bestLiftCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  bestLiftHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xs },
  bestLiftLabel: { ...typeScale.micro, color: colors.gold, textTransform: 'uppercase', letterSpacing: 0.5 },
  bestLiftExercise: { ...typeScale.subtitle, color: colors.text },
  bestLiftValue: { ...typeScale.display, color: colors.text, marginTop: spacing.xs },
  bestLiftEst: { ...typeScale.caption, color: colors.textMuted, marginTop: spacing.xs },
  sectionTitle: { ...typeScale.subtitle, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  emptyInline: { ...typeScale.caption, color: colors.textFaint, fontStyle: 'italic' },
  prList: { gap: spacing.sm },
  prCard: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, marginRight: spacing.sm, ...shadow.raised },
  prIcon: { marginBottom: spacing.xs },
  prExercise: { ...typeScale.caption, color: colors.text, fontWeight: '700' },
  prValue: { ...typeScale.caption, color: colors.textMuted, marginTop: spacing.xs },
  workoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  workoutDetail: { ...typeScale.body, color: colors.text },
  workoutTime: { ...typeScale.caption, color: colors.textFaint },
});
