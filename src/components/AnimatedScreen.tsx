import React, { useCallback } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';

// Re-fades on every focus (not just first mount) so tab switches and
// stack pushes/pops all get the same smooth transition, including
// returning to a screen React Navigation kept mounted in the background.
function useFadeOnFocus() {
  const opacity = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      opacity.value = 0;
      opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
    }, [opacity])
  );

  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);

interface AnimatedScreenProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
}

export function AnimatedScreen({ children, style, edges = ['top'] }: AnimatedScreenProps) {
  const animatedStyle = useFadeOnFocus();
  return (
    <AnimatedSafeAreaView edges={edges} style={[style, animatedStyle]}>
      {children}
    </AnimatedSafeAreaView>
  );
}

interface AnimatedViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function AnimatedView({ children, style }: AnimatedViewProps) {
  const animatedStyle = useFadeOnFocus();
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
