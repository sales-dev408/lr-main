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
      <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan' }} />
      <Tabs.Screen name="mypass" options={{ title: 'My Pass' }} />
      <Tabs.Screen name="tickets" options={{ title: 'Tickets' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
