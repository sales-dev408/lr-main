import type { ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/appTheme';
import { useThemeColors } from '@/lib/useThemeColors';
import { useAppColorScheme } from '@/lib/colorScheme';
import { useDynamicType } from '@/lib/dynamicType';

// Expo Router vendors its own copy of react-navigation, so derive the tab bar
// props from the navigator rather than importing them from a build path.
type GradientTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

// Glyphs are drawn with text so the tab bar stays dependency-light while the
// gradient plates carry the visual identity.
const TAB_GLYPHS: Record<string, string> = {
  index: '⌂',
  live: '⚡',
  browse: '◆',
  events: '★',
  apartments: '🏠',
  discover: '✦',
  profile: '●',
};

function useTabStyles() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const multiplier = effectiveScale;

  return {
    colors,
    multiplier,
    styles: StyleSheet.create({
      bar: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-end',
        // Use a translucent background so the Liquid Glass blur material shows
        // through on iOS. On web/Android, fall back to the solid panel color.
        backgroundColor: isLiquidGlassSupported
          ? 'transparent'
          : Platform.select({ ios: 'transparent', default: colors.panel }),
        borderTopWidth: isLiquidGlassSupported ? 0 : Platform.select({ ios: 0, default: 1 }),
        borderTopColor: colors.border,
        paddingTop: 8,
        paddingHorizontal: 4,
        paddingBottom: 6,
      },
      blurContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderTopWidth: 0,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      },
      tab: {
        flex: 1,
        alignItems: 'center',
        gap: 4,
      },
      icon: {
        width: 34 * multiplier,
        height: 34 * multiplier,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
      },
      iconShadow: Platform.select({
        web: { boxShadow: `0 4px 10px ${colors.ink}1f` },
        default: { shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10 },
      }) as Record<string, unknown>,
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
        fontSize: 16,
        fontWeight: '800',
      },
      label: {
        fontSize: 12,
        fontWeight: '700',
        marginTop: 3,
      },
    }),
  };
}

export function GradientTabBar({ state, descriptors, navigation }: GradientTabBarProps) {
  const insets = useSafeAreaInsets();
  const { tabFor } = useAppTheme();
  const { scheme } = useAppColorScheme();
  const { styles, colors, multiplier } = useTabStyles();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {isLiquidGlassSupported ? (
        <LiquidGlassView
          effect="regular"
          colorScheme={scheme}
          style={styles.blurContainer}
        />
      ) : Platform.OS === 'ios' ? (
        <BlurView
          intensity={100}
          tint={scheme}
          style={styles.blurContainer}
        />
      ) : null}
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
              style={[styles.icon, styles.iconShadow, focused ? styles.iconFocused : styles.iconIdle]}
            >
              <Text style={[styles.glyph, { fontSize: 16 * multiplier }]} allowFontScaling={false}>
                {TAB_GLYPHS[route.name] ?? '•'}
              </Text>
            </LinearGradient>
            <Text style={[styles.label, { color: focused ? tab.color : colors.subtle, fontSize: 12 * multiplier }]} numberOfLines={1} allowFontScaling={false}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
