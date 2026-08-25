import React, { useEffect, useMemo } from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Badge } from '../lib/badges';
import { useReducedMotion } from '../lib/useReducedMotion';
import { useThemeColors, radius, spacing, type as typeScale, shadow, ThemeColors } from '../lib/theme';

interface CelebrationModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  badges: Badge[];
  onDismiss: () => void;
}

export function CelebrationModal({ visible, title, subtitle, badges, onDismiss }: CelebrationModalProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (reducedMotion) {
        scale.value = 1;
        opacity.value = 1;
      } else {
        scale.value = withSpring(1, { damping: 12, stiffness: 180 });
        opacity.value = withTiming(1, { duration: 200 });
      }
    } else {
      scale.value = reducedMotion ? 1 : 0.6;
      opacity.value = 0;
    }
  }, [visible, scale, opacity, reducedMotion]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, cardStyle]}>
          <View style={styles.iconCircle}>
            <Ionicons name="trophy" size={36} color={colors.gold} />
          </View>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          {badges.length > 0 && (
            <View style={styles.badgeRow}>
              {badges.map((badge) => (
                <View key={badge.id} style={styles.badgeChip}>
                  <Ionicons name={badge.icon} size={14} color={colors.gold} />
                  <Text style={styles.badgeChipText}>{badge.label}</Text>
                </View>
              ))}
            </View>
          )}
          <Pressable style={styles.button} onPress={onDismiss}>
            <Text style={styles.buttonText}>Nice!</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    card: {
      width: '100%',
      maxWidth: 320,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.gold,
      ...shadow.card,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primaryMuted,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    title: { ...typeScale.display, color: colors.text, textAlign: 'center' },
    subtitle: { ...typeScale.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg },
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
    button: {
      marginTop: spacing.xl,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.xxl,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
    },
    buttonText: { color: colors.white, fontWeight: '700' },
  });
}
