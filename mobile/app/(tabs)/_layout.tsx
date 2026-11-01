import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { CollapsibleSidebar } from '@/components/CollapsibleSidebar';

// All app navigation lives in the collapsible sidebar — the bottom tab bar is
// completely hidden (tabBar renders nothing) and every route stays hidden from
// the native tab UI. The sidebar overlay sits above the navigator.
export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        initialRouteName="index"
        screenOptions={{ headerShown: false, tabBarShowLabel: false }}
        tabBar={() => null}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="events" options={{ title: 'Events' }} />
        <Tabs.Screen name="sports" options={{ title: 'Sports' }} />
        <Tabs.Screen name="restaurants" options={{ title: 'Restaurants & Bars' }} />
        <Tabs.Screen name="shopping" options={{ title: 'Shopping' }} />
        <Tabs.Screen name="beauty" options={{ title: 'Health & Beauty' }} />
        <Tabs.Screen name="live" options={{ title: 'Train Times' }} />
        <Tabs.Screen name="hotels" options={{ title: 'Hotels' }} />
        <Tabs.Screen name="apartments" options={{ title: 'Apartments' }} />
        <Tabs.Screen name="real-estate" options={{ title: 'Real Estate' }} />
        <Tabs.Screen name="discover" options={{ title: 'Discover Articles' }} />
        <Tabs.Screen name="az-events" options={{ title: 'Events Around Arizona' }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
        <Tabs.Screen name="notifications" options={{ title: 'Notifications' }} />
      </Tabs>
      <CollapsibleSidebar />
    </View>
  );
}
