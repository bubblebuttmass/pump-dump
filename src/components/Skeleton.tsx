import React, { useEffect } from 'react';
import { StyleProp, ViewStyle, StyleSheet, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useReducedMotion } from '../lib/useReducedMotion';
import { colors, radius, spacing } from '../lib/theme';

export function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    if (reducedMotion) {
      // A steady mid-opacity block still reads as "loading" via its shape,
      // without the pulsing loop reduce-motion users asked to avoid.
      opacity.value = 0.6;
      return;
    }
    opacity.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.block, style, animatedStyle]} />;
}

export function FeedCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <SkeletonBlock style={styles.avatar} />
        <SkeletonBlock style={styles.nameLine} />
      </View>
      <SkeletonBlock style={styles.photo} />
      <SkeletonBlock style={styles.textLine} />
      <SkeletonBlock style={[styles.textLine, { width: '60%' }]} />
    </View>
  );
}

export function ProfileHeaderSkeleton() {
  return (
    <View style={styles.profileHeader}>
      <SkeletonBlock style={styles.avatarLarge} />
      <SkeletonBlock style={styles.profileName} />
      <SkeletonBlock style={styles.profileBio} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.surfaceRaised, borderRadius: radius.sm },
  card: { padding: spacing.lg, borderBottomWidth: 1, borderColor: colors.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  nameLine: { width: 120, height: 16 },
  // Matches PhotoCarousel's default 3:4 aspect so the skeleton doesn't jump
  // in height once the real photo loads in.
  photo: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md, marginBottom: spacing.md },
  textLine: { width: '90%', height: 12, marginTop: spacing.xs },
  profileHeader: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  avatarLarge: { width: 80, height: 80, borderRadius: 40 },
  profileName: { width: 140, height: 20, marginTop: spacing.sm },
  profileBio: { width: 100, height: 14 },
});
