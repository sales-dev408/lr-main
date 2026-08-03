import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/appTheme';
import { theme } from '@/lib/theme';

// Expo Router vendors its own copy of react-navigation, so derive the tab bar
// props from the navigator rather than importing them from a build path.
type GradientTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

// Glyphs are drawn with text so the tab bar stays dependency-light while the
// blue/red/green gradient plates carry the visual identity.
const TAB_GLYPHS: Record<string, string> = {
  vendors: '◆',
  index: '▲',
  events: '★',
  discover: '✦',
  passes: '❖',
  profile: '●',
};

export function GradientTabBar({ state, descriptors, navigation }: GradientTabBarProps) {
  const insets = useSafeAreaInsets();
  const { tabFor } = useAppTheme();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const tab = tabFor(route.name);
        const options = descriptors[route.key]?.options;
        const label = typeof options?.title === 'string' ? options.title : tab.label;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={label}
            style={styles.tab}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
          >
            <LinearGradient
              colors={tab.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.icon, focused ? styles.iconFocused : styles.iconIdle]}
            >
              <Text style={styles.glyph}>{TAB_GLYPHS[route.name] ?? '•'}</Text>
            </LinearGradient>
            <Text style={[styles.label, { color: focused ? tab.color : theme.subtle }]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    backgroundColor: theme.panel,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFocused: {
    opacity: 1,
    transform: [{ scale: 1 }],
  },
  iconIdle: {
    opacity: 0.5,
    transform: [{ scale: 0.92 }],
  },
  glyph: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
});
