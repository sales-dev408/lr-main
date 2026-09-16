import { Tabs } from 'expo-router';
import { GradientTabBar } from '@/components/GradientTabBar';

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{ headerShown: false, tabBarShowLabel: false }}
      tabBar={(props) => <GradientTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="browse" options={{ title: 'Browse' }} />
      <Tabs.Screen name="events" options={{ title: 'Events' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
      {/* These screens stay routable (reachable from the More tab) but are
          hidden from the bottom tab bar via href: null. */}
      <Tabs.Screen name="live" options={{ title: 'Train Schedule', href: null }} />
      <Tabs.Screen name="apartments" options={{ title: 'Apartments', href: null }} />
      <Tabs.Screen name="sports" options={{ title: 'Sports', href: null }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover', href: null }} />
    </Tabs>
  );
}
