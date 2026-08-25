import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from '../lib/useReducedMotion';
import { useThemeColors, ThemeColors } from '../lib/theme';

interface AnimatedTabIconProps {
  name: React.ComponentProps<typeof Ionicons>['name'];
  activeName: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  size: number;
  focused: boolean;
}

// React Navigation re-renders tabBarIcon with a fresh `focused` prop on every
// tab change rather than mounting/unmounting it, so animating off that prop
// (instead of a press handler) is what actually drives the transition here.
export function AnimatedTabIcon({ name, activeName, color, size, focused }: AnimatedTabIconProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const dotOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = reducedMotion ? (focused ? 1.15 : 1) : withSpring(focused ? 1.15 : 1, { damping: 10, stiffness: 220 });
    dotOpacity.value = reducedMotion ? (focused ? 1 : 0) : withTiming(focused ? 1 : 0, { duration: 150 });
  }, [focused, scale, dotOpacity, reducedMotion]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={iconStyle}>
        <Ionicons name={focused ? activeName : name} size={size} color={color} />
      </Animated.View>
      <Animated.View style={[styles.dot, dotStyle]} />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { alignItems: 'center', justifyContent: 'center' },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary, marginTop: 4 },
  });
}
