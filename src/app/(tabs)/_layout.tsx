import { Tabs } from 'expo-router';
import { colors } from '../../lib/theme';
import { AnimatedTabIcon } from '../../components/AnimatedTabIcon';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="feed/index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="home-outline" activeName="home" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="log/index"
        options={{
          title: 'Post',
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="add-circle-outline" activeName="add-circle" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="search/index"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="search-outline" activeName="search" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="person-circle-outline" activeName="person-circle" color={color} size={size} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
