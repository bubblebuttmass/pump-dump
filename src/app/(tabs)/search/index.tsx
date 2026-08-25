import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Keyboard, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, Href } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { searchUsers, getFollowStatus, follow, unfollow, UserResult, FollowStatus } from '../../../lib/social-graph';
import { searchExercises, Exercise } from '../../../lib/exercises';
import { getSuggestedUsers, getTrendingExercises, SuggestedUser, TrendingExercise } from '../../../lib/discovery';
import { getRecentSearches, addRecentSearch, removeRecentSearch } from '../../../lib/recentSearches';
import { showAlert } from '../../../lib/alert';
import { AnimatedScreen } from '../../../components/AnimatedScreen';
import { PressableScale } from '../../../components/PressableScale';
import { useThemeColors, radius, spacing, type as typeScale, shadow, ThemeColors } from '../../../lib/theme';

export default function Search() {
  const { session } = useAuth();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [exerciseResults, setExerciseResults] = useState<Exercise[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, FollowStatus>>({});
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [trendingExercises, setTrendingExercises] = useState<TrendingExercise[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!session?.user) return;
      getRecentSearches(session.user.id).then(setRecentSearches);
      getSuggestedUsers(session.user.id).then(setSuggestedUsers);
      getTrendingExercises().then(setTrendingExercises);
    }, [session])
  );

  async function runSearch(text: string) {
    if (!session?.user || text.trim().length === 0) {
      setUserResults([]);
      setExerciseResults([]);
      return;
    }
    const [users, exercises] = await Promise.all([searchUsers(text, session.user.id), searchExercises(text)]);
    setUserResults(users);
    setExerciseResults(exercises);
    const statuses = await Promise.all(users.map((u) => getFollowStatus(session.user.id, u.id)));
    setFollowingMap((prev) => ({ ...prev, ...Object.fromEntries(users.map((u, i) => [u.id, statuses[i]])) }));
  }

  function handleChangeText(text: string) {
    setQuery(text);
    runSearch(text);
  }

  async function handleSubmit() {
    Keyboard.dismiss();
    if (!session?.user || query.trim().length === 0) return;
    await addRecentSearch(session.user.id, query);
    setRecentSearches(await getRecentSearches(session.user.id));
  }

  function handleTapRecent(term: string) {
    setQuery(term);
    runSearch(term);
  }

  async function handleRemoveRecent(term: string) {
    if (!session?.user) return;
    await removeRecentSearch(session.user.id, term);
    setRecentSearches(await getRecentSearches(session.user.id));
  }

  async function handleToggleFollow(userId: string) {
    if (!session?.user) return;
    const current = followingMap[userId] ?? 'none';
    if (current === 'none') {
      setFollowingMap((prev) => ({ ...prev, [userId]: 'accepted' }));
      setSuggestedUsers((prev) => prev.filter((u) => u.id !== userId));
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

  const showingResults = query.trim().length > 0;

  return (
    <AnimatedScreen style={styles.container}>
      <View style={styles.inputWrap}>
        <Ionicons name="search" size={16} color={colors.textFaint} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Search lifters or exercises..."
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={handleChangeText}
          returnKeyType="search"
          onSubmitEditing={handleSubmit}
          accessibilityLabel="Search lifters or exercises"
        />
      </View>

      {!showingResults ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          {recentSearches.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Searches</Text>
              <View style={styles.chipWrapRow}>
                {recentSearches.map((term) => (
                  <Pressable
                    key={term}
                    style={styles.recentChip}
                    onPress={() => handleTapRecent(term)}
                    accessibilityRole="button"
                    accessibilityLabel={`Search for ${term}`}
                  >
                    <Text style={styles.recentChipText}>{term}</Text>
                    <Pressable
                      onPress={() => handleRemoveRecent(term)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${term} from recent searches`}
                    >
                      <Ionicons name="close" size={13} color={colors.textFaint} />
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Suggested Lifters</Text>
            {suggestedUsers.length === 0 ? (
              <Text style={styles.emptyInline}>No suggestions right now</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
                {suggestedUsers.map((u) => (
                  <View key={u.id} style={styles.suggestedCard}>
                    <Pressable onPress={() => router.push(`/user/${u.id}` as Href)} style={styles.suggestedCardTap}>
                      {u.avatar_url ? (
                        <Image source={{ uri: u.avatar_url }} style={styles.suggestedAvatar} contentFit="cover" cachePolicy="memory-disk" transition={200} />
                      ) : (
                        <View style={[styles.suggestedAvatar, styles.avatarPlaceholder]} />
                      )}
                      <Text style={styles.suggestedName} numberOfLines={1}>{u.display_name}</Text>
                      <Text style={styles.suggestedMeta}>{u.followerCount} followers</Text>
                      {u.gym && (
                        <View style={styles.suggestedDetailRow}>
                          <Ionicons name="business-outline" size={10} color={colors.textFaint} />
                          <Text style={styles.suggestedDetailText} numberOfLines={1}>{u.gym}</Text>
                        </View>
                      )}
                      {u.favoriteLift && (
                        <View style={styles.suggestedDetailRow}>
                          <Ionicons name="barbell-outline" size={10} color={colors.textFaint} />
                          <Text style={styles.suggestedDetailText} numberOfLines={1}>{u.favoriteLift}</Text>
                        </View>
                      )}
                    </Pressable>
                    <PressableScale style={styles.followButtonSmall} onPress={() => handleToggleFollow(u.id)} scaleTo={0.92}>
                      <Text style={styles.followButtonText}>Follow</Text>
                    </PressableScale>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trending Exercises</Text>
            {trendingExercises.length === 0 ? (
              <Text style={styles.emptyInline}>Nothing trending yet</Text>
            ) : (
              <View style={styles.chipWrapRow}>
                {trendingExercises.map((e) => (
                  <View key={e.id} style={styles.trendingChip}>
                    <Ionicons name="flame" size={12} color={colors.accent} />
                    <Text style={styles.trendingChipText}>{e.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <Text style={styles.sectionTitle}>Lifters</Text>
          {userResults.length === 0 ? (
            <Text style={styles.emptyInline}>No lifters found for "{query}"</Text>
          ) : (
            userResults.map((item) => (
              <View key={item.id} style={styles.row}>
                <Pressable style={styles.nameArea} onPress={() => router.push(`/user/${item.id}` as Href)}>
                  <Text style={styles.name}>{item.display_name}</Text>
                </Pressable>
                <PressableScale
                  style={[styles.followButton, followingMap[item.id] !== 'none' && followingMap[item.id] && styles.followButtonActive]}
                  onPress={() => handleToggleFollow(item.id)}
                  scaleTo={0.94}
                >
                  <Text style={[styles.followButtonText, followingMap[item.id] !== 'none' && followingMap[item.id] && styles.followButtonTextActive]}>
                    {followingMap[item.id] === 'accepted' ? 'Unfollow' : followingMap[item.id] === 'pending' ? 'Requested' : 'Follow'}
                  </Text>
                </PressableScale>
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Exercises</Text>
          {exerciseResults.length === 0 ? (
            <Text style={styles.emptyInline}>No exercises found for "{query}"</Text>
          ) : (
            <View style={styles.chipWrapRow}>
              {exerciseResults.map((e) => (
                <View key={e.id} style={styles.trendingChip}>
                  <Ionicons name="barbell-outline" size={12} color={colors.textFaint} />
                  <Text style={styles.trendingChipText}>{e.name}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </AnimatedScreen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
    scroll: { paddingBottom: spacing.xxl },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
    },
    inputIcon: { marginRight: spacing.xs },
    input: { flex: 1, paddingVertical: spacing.md, color: colors.text, ...typeScale.body },
    section: { marginBottom: spacing.lg },
    sectionTitle: { ...typeScale.subtitle, color: colors.text, marginBottom: spacing.sm },
    emptyInline: { ...typeScale.caption, color: colors.textFaint, fontStyle: 'italic' },
    chipWrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    recentChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
    },
    recentChipText: { ...typeScale.caption, color: colors.textMuted },
    trendingChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
    },
    trendingChipText: { ...typeScale.caption, color: colors.textMuted },
    horizontalList: { gap: spacing.md },
    suggestedCard: {
      width: 148,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      alignItems: 'center',
      ...shadow.raised,
    },
    suggestedCardTap: { alignItems: 'center', width: '100%' },
    suggestedAvatar: { width: 56, height: 56, borderRadius: 28 },
    avatarPlaceholder: { backgroundColor: colors.surfaceRaised },
    suggestedName: { ...typeScale.caption, color: colors.text, fontWeight: '700', marginTop: spacing.sm },
    suggestedMeta: { ...typeScale.micro, color: colors.textFaint, marginTop: 2 },
    suggestedDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3, maxWidth: '100%' },
    suggestedDetailText: { ...typeScale.micro, color: colors.textFaint, flexShrink: 1 },
    followButtonSmall: {
      marginTop: spacing.sm,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.sm,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    nameArea: { flex: 1 },
    name: { ...typeScale.body, color: colors.text },
    followButton: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm },
    followButtonActive: { backgroundColor: colors.surfaceRaised },
    followButtonText: { ...typeScale.caption, color: colors.white, fontWeight: '700' },
    followButtonTextActive: { color: colors.textMuted },
  });
}
