import { useWindowDimensions, View } from 'react-native';
import { Tabs } from 'expo-router';
import { CollapsibleSidebar, SIDEBAR_COLLAPSED } from '@/components/CollapsibleSidebar';
import { GradientTabBar } from '@/components/GradientTabBar';
import { useDynamicType } from '@/lib/dynamicType';

const SIDEBAR_BREAKPOINT = 600;

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const { effectiveScale } = useDynamicType();
  const useSidebar = width < SIDEBAR_BREAKPOINT;

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {useSidebar ? <CollapsibleSidebar /> : null}
      <View style={{ flex: 1, marginLeft: useSidebar ? SIDEBAR_COLLAPSED * effectiveScale : 0 }}>
        <Tabs
          initialRouteName="index"
          screenOptions={{ headerShown: false, tabBarShowLabel: false }}
          tabBar={useSidebar ? () => null : (props) => <GradientTabBar {...props} />}
        >
          <Tabs.Screen name="index" options={{ title: 'Home' }} />
          <Tabs.Screen name="live" options={{ title: 'Live Train Times' }} />
          <Tabs.Screen name="browse" options={{ title: 'Browse' }} />
          <Tabs.Screen name="events" options={{ title: 'Events' }} />
          <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
          <Tabs.Screen name="mypass" options={{ title: 'My Pass' }} />
          <Tabs.Screen name="tickets" options={{ title: 'Tickets' }} />
          <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        </Tabs>
      </View>
    </View>
  );
}
