import { Ionicons } from '@expo/vector-icons';

export interface Badge {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}

interface BadgeInput {
  workoutCount: number;
  prCount: number;
  streak: number;
}

const BADGE_DEFS: { id: string; label: string; icon: Badge['icon']; earned: (i: BadgeInput) => boolean }[] = [
  { id: 'first-pump', label: 'First Pump', icon: 'flag', earned: (i) => i.workoutCount >= 1 },
  { id: 'ten-pumps', label: '10 Pumps', icon: 'flame', earned: (i) => i.workoutCount >= 10 },
  { id: 'fifty-pumps', label: '50 Pumps', icon: 'flame', earned: (i) => i.workoutCount >= 50 },
  { id: 'first-pr', label: 'First PR', icon: 'trophy', earned: (i) => i.prCount >= 1 },
  { id: 'pr-chaser', label: 'PR Chaser', icon: 'trophy', earned: (i) => i.prCount >= 5 },
  { id: 'week-streak', label: '7 Day Streak', icon: 'bonfire', earned: (i) => i.streak >= 7 },
  { id: 'month-streak', label: '30 Day Streak', icon: 'bonfire', earned: (i) => i.streak >= 30 },
];

export function computeBadges(input: BadgeInput): Badge[] {
  return BADGE_DEFS.filter((b) => b.earned(input)).map(({ id, label, icon }) => ({ id, label, icon }));
}
