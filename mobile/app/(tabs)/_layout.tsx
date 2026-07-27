import { Tabs } from 'expo-router';
import { GradientTabBar } from '@/components/GradientTabBar';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <GradientTabBar {...props} />}>
      <Tabs.Screen name="vendors" options={{ title: 'Deals' }} />
      <Tabs.Screen name="index" options={{ title: 'Browse' }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
      <Tabs.Screen name="passes" options={{ title: 'My Pass' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
