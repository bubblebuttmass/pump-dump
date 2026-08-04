import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, Switch, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { getProfile, updatePrivacy } from '../lib/profile';
import { getFollowRequests } from '../lib/social-graph';
import { deleteAccount } from '../lib/account';
import { showAlert } from '../lib/alert';
import { AnimatedScreen } from '../components/AnimatedScreen';
import { colors, radius, spacing, type as typeScale } from '../lib/theme';

export default function Settings() {
  const { session } = useAuth();
  const [isPrivate, setIsPrivate] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!session?.user) return;
      getProfile(session.user.id, session.user.id).then((profile) => {
        setIsPrivate(profile.isPrivate);
        setLoaded(true);
      });
      getFollowRequests(session.user.id).then((reqs) => setPendingRequestCount(reqs.length));
    }, [session])
  );

  async function handleTogglePrivate(value: boolean) {
    if (!session?.user) return;
    const previous = isPrivate;
    setIsPrivate(value);
    try {
      await updatePrivacy(session.user.id, value);
    } catch {
      setIsPrivate(previous);
    }
  }

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This permanently deletes your account, posts, and photos. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Are you absolutely sure?', 'There is no way to recover your account after this.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete Forever',
                style: 'destructive',
                onPress: async () => {
                  setDeleting(true);
                  try {
                    await deleteAccount();
                    await supabase.auth.signOut();
                  } catch (e: any) {
                    showAlert('Could not delete account', e.message ?? String(e));
                  } finally {
                    setDeleting(false);
                  }
                },
              },
            ]);
          },
        },
      ]
    );
  }

  return (
    <AnimatedScreen style={styles.container}>
      <View style={styles.backBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>

      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.card}>
        <Pressable style={styles.row} onPress={() => router.push('/(tabs)/profile/edit')}>
          <Text style={styles.rowLabel}>Edit Profile</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Pressable>
        <View style={styles.separator} />
        <Pressable style={styles.row} onPress={() => router.push('/follow-requests')}>
          <Text style={styles.rowLabel}>Follow Requests</Text>
          <View style={styles.rowRight}>
            {pendingRequestCount > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{pendingRequestCount > 9 ? '9+' : pendingRequestCount}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </View>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Privacy & Safety</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowLabel}>Private Account</Text>
            <Text style={styles.rowHint}>New followers need your approval, and only followers see your posts.</Text>
          </View>
          <Switch
            value={isPrivate}
            onValueChange={handleTogglePrivate}
            disabled={!loaded}
            trackColor={{ true: colors.primary, false: colors.surfaceRaised }}
            thumbColor={colors.white}
          />
        </View>
        <View style={styles.separator} />
        <Pressable style={styles.row} onPress={() => router.push('/blocked-accounts')}>
          <Text style={styles.rowLabel}>Blocked Accounts</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>About</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Version</Text>
          <Text style={styles.rowValue}>{Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </View>
      </View>

      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      <Pressable style={styles.deleteAccountButton} onPress={handleDeleteAccount} disabled={deleting}>
        <Text style={styles.deleteAccountText}>{deleting ? 'Deleting...' : 'Delete Account'}</Text>
      </Pressable>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  backBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.lg },
  title: { ...typeScale.subtitle, color: colors.text },
  sectionTitle: { ...typeScale.caption, color: colors.textFaint, marginBottom: spacing.sm, marginTop: spacing.lg, textTransform: 'uppercase' },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowTextWrap: { flex: 1 },
  rowLabel: { ...typeScale.body, color: colors.text },
  rowHint: { ...typeScale.caption, color: colors.textFaint, marginTop: 2 },
  rowValue: { ...typeScale.body, color: colors.textFaint },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  countBadge: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md },
  signOutButton: { marginTop: spacing.xl, alignItems: 'center', padding: spacing.md },
  signOutText: { color: colors.danger, ...typeScale.subtitle },
  deleteAccountButton: { alignItems: 'center', padding: spacing.md, marginBottom: spacing.xl },
  deleteAccountText: { color: colors.textFaint, ...typeScale.caption },
});
