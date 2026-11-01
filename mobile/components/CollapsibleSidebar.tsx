import { useCallback, useEffect, useState } from 'react';
import { Animated, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/appTheme';
import { useAppColorScheme } from '@/lib/colorScheme';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';

type NavItem = {
  key: string;
  label: string;
  icon: string;
  href: `/${string}`;
};

// Sidebar order per the restructure brief: the divider line between the main
// directory sections and the informational/settings entries is intentional.
const PRIMARY_ITEMS: NavItem[] = [
  { key: 'index', label: 'Home', icon: '⌂', href: '/' },
  { key: 'events', label: 'Events', icon: '★', href: '/events' },
  { key: 'sports', label: 'Sports', icon: '🏀', href: '/sports' },
  { key: 'restaurants', label: 'Restaurants & Bars', icon: '🍽', href: '/restaurants' },
  { key: 'shopping', label: 'Shopping', icon: '🛍', href: '/shopping' },
  { key: 'beauty', label: 'Beauty & Health', icon: '💅', href: '/beauty' },
  { key: 'live', label: 'Train Times', icon: '⚡', href: '/live' },
  { key: 'hotels', label: 'Hotels', icon: '🏨', href: '/hotels' },
  { key: 'apartments', label: 'Apartments', icon: '🏢', href: '/apartments' },
  { key: 'real-estate', label: 'Real Estate', icon: '🏘', href: '/real-estate' },
];

const SECONDARY_ITEMS: NavItem[] = [
  { key: 'discover', label: 'Discover Articles', icon: '✦', href: '/discover' },
  { key: 'az-events', label: 'Events Around Arizona', icon: '🌵', href: '/az-events' },
];

// The Settings area groups the settings screen with the notification inbox.
const SETTINGS_ITEMS: NavItem[] = [
  { key: 'settings', label: 'Settings', icon: '⚙', href: '/settings' },
  { key: 'notifications', label: 'Notifications', icon: '🔔', href: '/notifications' },
];

export function CollapsibleSidebar() {
  const colors = useThemeColors();
  const { scheme } = useAppColorScheme();
  const { tabFor } = useAppTheme();
  const { effectiveScale } = useDynamicType();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();

  const [visible, setVisible] = useState(false);
  const [slide] = useState(() => new Animated.Value(0));
  const panelWidth = Math.min(320, Math.max(260, width * 0.82));
  const activeKey = segments[segments.length - 1] ?? 'index';

  const open = useCallback(() => {
    setVisible(true);
    requestAnimationFrame(() => {
      Animated.timing(slide, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start();
    });
  }, [slide]);

  const close = useCallback(() => {
    Animated.timing(slide, { toValue: 0, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start(() => {
      setVisible(false);
    });
  }, [slide]);

  useEffect(() => () => slide.stopAnimation(), [slide]);

  function go(item: NavItem) {
    close();
    // Defer navigation until the drawer starts closing so the transition feels
    // instant without blocking the animation.
    setTimeout(() => router.navigate(item.href as never), 60);
  }

  function renderItem(item: NavItem) {
    const tab = tabFor(item.key);
    const active = activeKey === item.key;
    return (
      <Pressable
        key={item.key}
        onPress={() => go(item)}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: active }}
        style={({ pressed }) => [
          styles.navRow,
          {
            backgroundColor: active ? colors.brand + '1a' : pressed ? colors.brand + '0d' : 'transparent',
            borderLeftColor: active ? colors.accent : 'transparent',
          },
        ]}
      >
        <LinearGradient colors={tab.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.navIcon}>
          <Text style={styles.navIconText} allowFontScaling={false}>{item.icon}</Text>
        </LinearGradient>
        <Text
          style={{
            flex: 1,
            color: colors.ink,
            fontSize: 15 * effectiveScale,
            fontWeight: active ? '800' : '600',
          }}
          allowFontScaling={false}
        >
          {item.label}
        </Text>
        <Text style={{ color: colors.subtle, fontSize: 14 * effectiveScale }} allowFontScaling={false}>›</Text>
      </Pressable>
    );
  }

  const panelContent = (
    <View style={{ flex: 1 }}>
      <View style={[styles.brandBlock, { paddingTop: insets.top + 18, borderBottomColor: colors.border }]}>
        <Image source={require('@/assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={{ color: colors.ink, fontSize: 20 * effectiveScale, fontWeight: '800' }} allowFontScaling={false}>
          Light Rail Deals
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 * effectiveScale }} allowFontScaling={false}>
          Your guide to the Valley Metro Area
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 10 }}>
        {PRIMARY_ITEMS.map(renderItem)}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        {SECONDARY_ITEMS.map(renderItem)}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={{ color: colors.muted, fontSize: 11 * effectiveScale, fontWeight: '700', marginHorizontal: 20, marginTop: 4, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.8 }} allowFontScaling={false}>
          Settings
        </Text>
        {SETTINGS_ITEMS.map(renderItem)}
      </ScrollView>

    </View>
  );

  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [-panelWidth - 24, 0] });
  const backdropOpacity = slide.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <>
      {/* Hamburger trigger — floats in the top corner of every page, aligned
          with the top edge of Screen content (same padding math as Ui.tsx). */}
      <View
        style={[
          styles.fab,
          {
            top: insets.top + 12 + Math.round(Math.min(24, Math.max(16, width * 0.05)) * effectiveScale),
            right: 12,
            pointerEvents: 'box-none',
          },
        ]}
      >
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel="Open navigation menu"
          style={({ pressed }) => [styles.fabButton, { borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
        >
          {isLiquidGlassSupported ? (
            <LiquidGlassView effect="regular" colorScheme={scheme} style={StyleSheet.absoluteFill} />
          ) : Platform.OS === 'ios' ? (
            <BlurView intensity={80} tint={scheme} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.panel }]} />
          )}
          <View style={styles.fabBars}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.fabBar, { backgroundColor: colors.ink }]} />
            ))}
          </View>
        </Pressable>
      </View>

      <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
        <View style={styles.modalRoot}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}>
            <Pressable onPress={close} accessibilityLabel="Close navigation menu" style={StyleSheet.absoluteFill}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12, 10, 9, 0.45)' }]} />
            </Pressable>
          </Animated.View>
          <Animated.View
            style={[
              styles.panel,
              {
                width: panelWidth,
                borderRightColor: colors.border,
                transform: [{ translateX }],
              },
            ]}
          >
            {isLiquidGlassSupported ? (
              <LiquidGlassView effect="regular" colorScheme={scheme} style={StyleSheet.absoluteFill} />
            ) : Platform.OS === 'ios' ? (
              <BlurView intensity={95} tint={scheme} style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.panel }]} />
            )}
            {panelContent}
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    zIndex: 50,
  },
  fabButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabBars: {
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabBar: {
    width: 18,
    height: 2.4,
    borderRadius: 1.2,
  },
  modalRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  panel: {
    height: '100%',
    borderRightWidth: 1,
    overflow: 'hidden',
  },
  brandBlock: {
    alignItems: 'center',
    gap: 6,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: 2,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 10,
    marginVertical: 2,
    paddingHorizontal: 10,
    paddingVertical: 11,
    borderRadius: 14,
    borderLeftWidth: 3,
  },
  navIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    marginHorizontal: 18,
    marginVertical: 10,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  authButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
