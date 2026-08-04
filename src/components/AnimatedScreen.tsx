import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useReducedMotion } from '../lib/useReducedMotion';

// Fades in once, on first mount, not on every focus. React Navigation keeps
// tab/stack screens mounted after their first visit, so re-fading on every
// focus meant every single tab switch replayed a 220ms dim-then-brighten
// pulse -- with bottom-tabs having no transition of its own, that pulse was
// the only thing visibly happening on tap, which read as flicker. A fresh
// mount (first visit, or a new dynamic-route instance like a different
// workout id) still gets the entrance fade; revisiting an already-mounted
// screen now shows instantly, like every other polished app.
function useFadeOnMount() {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 1;
      return;
    }
    opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
  }, [opacity, reducedMotion]);

  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);

interface AnimatedScreenProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
}

export function AnimatedScreen({ children, style, edges = ['top'] }: AnimatedScreenProps) {
  const animatedStyle = useFadeOnMount();
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
  const animatedStyle = useFadeOnMount();
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
