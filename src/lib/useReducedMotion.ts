import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// System-level "Reduce Motion" (iOS Settings > Accessibility, or the
// equivalent Android setting). Screens/components with a decorative
// animation should check this and skip straight to the end state instead
// of playing it -- Apple explicitly reviews for this during App Store
// evaluation, and it's a real usability need for vestibular disorders,
// not just a nice-to-have.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => subscription.remove();
  }, []);

  return reduced;
}
