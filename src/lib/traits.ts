export interface TraitCategory {
  label: string;
  options: string[];
}

export const TRAIT_CATEGORIES: TraitCategory[] = [
  {
    label: 'Training split',
    options: ['Push/Pull/Legs', 'Upper/Lower', 'Bro Split', 'Arnold Split', 'Full Body', 'Powerlifting Split', 'Hybrid Split'],
  },
  {
    label: 'Training focus',
    options: [
      'Bodybuilding',
      'Powerlifting',
      'Strength Training',
      'Calisthenics',
      'CrossFit',
      'Olympic Lifting',
      'Cardio',
      'General Fitness',
    ],
  },
  {
    label: 'Gym vibe',
    options: [
      'Gym Rat',
      'Morning Lifter',
      'Night Owl',
      'PR Chaser',
      'Solo Lifter',
      'Looking for a Gym Buddy',
      'Form Over Ego',
      'Progressive Overload Nerd',
    ],
  },
];
