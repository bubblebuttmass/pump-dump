import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="feed/index" options={{ title: 'Feed' }} />
      <Tabs.Screen name="log/index" options={{ title: 'Post' }} />
      <Tabs.Screen name="search/index" options={{ title: 'Search' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
