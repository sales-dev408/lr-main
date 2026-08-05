import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/appTheme';
import { useThemeColors } from '@/lib/useThemeColors';

const MAX_FONT_MULTIPLIER = 1.3;
export const SIDEBAR_COLLAPSED = 72;
export const SIDEBAR_EXPANDED = 170;

const TAB_GLYPHS: Record<string, string> = {
  index: '⌂',
  browse: '◆',
  events: '★',
  discover: '✦',
  mypass: '❖',
  tickets: '♦',
  profile: '●',
};

const TAB_ORDER = ['index', 'browse', 'events', 'discover', 'mypass', 'tickets', 'profile'] as const;

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
  const { fontScale } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const active = activeRouteName(pathname ?? '/');
  const multiplier = Math.min(fontScale, MAX_FONT_MULTIPLIER);

  const width = expanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED;

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
        style={[styles.toggle, { backgroundColor: colors.brandSoft }]}
        onPress={() => setExpanded((prev) => !prev)}
      >
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink }}>{expanded ? '‹' : '›'}</Text>
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
              <LinearGradient colors={tab.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.icon, focused ? styles.iconFocused : styles.iconIdle]}>
                <Text style={[styles.glyph, { fontSize: 16 * multiplier }]} maxFontSizeMultiplier={MAX_FONT_MULTIPLIER}>
                  {TAB_GLYPHS[tab.name] ?? '•'}
                </Text>
              </LinearGradient>
              {expanded ? (
                <Text style={[styles.label, { color: focused ? tab.color : colors.subtle, fontSize: 14 * multiplier }]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_MULTIPLIER}>
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
