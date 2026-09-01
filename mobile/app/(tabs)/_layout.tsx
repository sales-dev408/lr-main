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
      <Tabs.Screen name="live" options={{ title: 'Train Schedule' }} />
      <Tabs.Screen name="browse" options={{ title: 'Browse' }} />
      <Tabs.Screen name="events" options={{ title: 'Events' }} />
      <Tabs.Screen name="apartments" options={{ title: 'Apartments' }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
