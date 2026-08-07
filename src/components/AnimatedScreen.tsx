import { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

// Previously faded in once on mount (220ms opacity 0->1). That fade -- even
// though it only ever ran once per screen, never on refocus -- still read as
// a "flicker" on every screen's first-ever appearance (Log/Post included,
// which has no async loading gate at all, ruling out a data-loading cause).
// Screens now appear instantly, no entrance transition, which is the
// simplest way to guarantee nothing can look like a flash on first mount.
function useFadeOnMount() {
  return useAnimatedStyle(() => ({ opacity: 1 }));
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
