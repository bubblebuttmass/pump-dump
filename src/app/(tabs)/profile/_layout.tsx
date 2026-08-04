import { Stack } from 'expo-router';
import { colors } from '../../../lib/theme';

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: 'Profile' }} />
      <Stack.Screen
        name="edit"
        options={{
          headerShown: true,
          title: 'Edit Profile',
          // Without this, React Navigation falls back to the previous
          // screen's title (or its raw route name, "index", if no title is
          // set there) as the back button's label -- showing the chevron
          // only sidesteps needing to coordinate titles across screens.
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text },
        }}
      />
    </Stack>
  );
}
