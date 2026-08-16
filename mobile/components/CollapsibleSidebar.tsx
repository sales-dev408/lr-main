import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/appTheme';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';

export const SIDEBAR_COLLAPSED = 72;
export const SIDEBAR_EXPANDED = 170;
const ICON_SIZE = 38;
const TOGGLE_SIZE = 38;

const TAB_GLYPHS: Record<string, string> = {
  index: '⌂',
  live: '⚡',
  browse: '◆',
  events: '★',
  discover: '✦',
  deals: '✶',
  mypass: '❖',
  profile: '●',
};

const TAB_ORDER = ['index', 'live', 'browse', 'events', 'discover', 'deals', 'mypass', 'profile'] as const;

function activeRouteName(pathname: string): string {
  const stripped = pathname.replace(/^\/(\(tabs\))?\/?/, '');
  const segment = stripped.split('/')[0];
  if (!segment) return 'index';
  return TAB_ORDER.includes(segment as (typeof TAB_ORDER)[number]) ? segment : 'index';
}

export function CollapsibleSidebar() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { tabFor } = useAppTheme();
  const { effectiveScale: multiplier } = useDynamicType();
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const active = activeRouteName(pathname ?? '/');

  const width = expanded ? SIDEBAR_EXPANDED * multiplier : SIDEBAR_COLLAPSED * multiplier;

  const tabs = useMemo(
    () =>
      TAB_ORDER.map((name) => ({
        name,
        label: tabFor(name).label,
        gradient: tabFor(name).gradient,
        color: tabFor(name).color,
        href: name === 'index' ? '/(tabs)' : `/(tabs)/${name}`,
      })),
    [tabFor],
  );

  return (
    <View style={[styles.container, { width, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, backgroundColor: colors.panel }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        style={[styles.toggle, { backgroundColor: colors.brandSoft, width: TOGGLE_SIZE * multiplier, height: TOGGLE_SIZE * multiplier }]}
        onPress={() => setExpanded((prev) => !prev)}
      >
        <Text style={{ fontSize: 20 * multiplier, fontWeight: '800', color: colors.ink }} allowFontScaling={false}>{expanded ? '‹' : '›'}</Text>
      </Pressable>

      <View style={{ gap: 8 }}>
        {tabs.map((tab) => {
          const focused = active === tab.name;
          return (
            <Pressable
              key={tab.name}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={tab.label}
              style={[styles.item, { backgroundColor: focused ? colors.brandSoft : 'transparent' }]}
              onPress={() => router.navigate(tab.href as any)}
            >
              <LinearGradient colors={tab.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.icon, focused ? styles.iconFocused : styles.iconIdle, { width: ICON_SIZE * multiplier, height: ICON_SIZE * multiplier }]}>
                <Text style={[styles.glyph, { fontSize: 16 * multiplier }]} allowFontScaling={false}>
                  {TAB_GLYPHS[tab.name] ?? '•'}
                </Text>
              </LinearGradient>
              {expanded ? (
                <Text style={[styles.label, { color: focused ? tab.color : colors.subtle, fontSize: 14 * multiplier }]} numberOfLines={1} allowFontScaling={false}>
                  {tab.label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    paddingHorizontal: 10,
    gap: 16,
    zIndex: 100,
  },
  toggle: {
    alignSelf: 'flex-end',
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    borderRadius: 14,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  iconFocused: {
    opacity: 1,
    transform: [{ scale: 1.05 }],
  },
  iconIdle: {
    opacity: 0.55,
    transform: [{ scale: 0.94 }],
  },
  glyph: {
    color: '#ffffff',
    fontWeight: '800',
  },
  label: {
    flex: 1,
    fontWeight: '700',
  },
});
