import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Scale factor while pressed. Smaller buttons read better with a subtler dip. */
  scaleTo?: number;
  haptic?: 'light' | 'medium' | 'none';
}

// Thin wrapper, not a design-system overhaul: swap Pressable for this on
// buttons that are a primary tap target (follow, like, submit, tab icons)
// so they get a consistent press-scale + haptic instead of RN's default
// "nothing visibly happens" on iOS.
export function PressableScale({ style, scaleTo = 0.94, haptic = 'light', onPressIn, onPressOut, onPress, ...props }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, { damping: 15, stiffness: 400 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 12, stiffness: 300 });
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic !== 'none') {
          Haptics.impactAsync(haptic === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
        }
        onPress?.(e);
      }}
      {...props}
    />
  );
}
