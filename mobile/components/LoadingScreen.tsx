import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useAppColorScheme } from '@/lib/colorScheme';
import { useThemeColors } from '@/lib/useThemeColors';

// havasu-falls.jpg is 1080x1626. When the screen is proportionally taller than
// the photo, `contain` leaves bars top and bottom; on wide screens the bars
// move to the sides.
const SPLASH_IMG_ASPECT = 1080 / 1626;

export function LoadingScreen({ message = 'Loading your guide…', ready = false, onContinue }: { message?: string; ready?: boolean; onContinue?: () => void }) {
  const { scheme } = useAppColorScheme();
  const colors = useThemeColors();
  const { width: winW, height: winH } = useWindowDimensions();
  const horizontalBars = winW / winH < SPLASH_IMG_ASPECT;

  const isDark = scheme === 'dark';
  const logoBg = isDark ? colors.ink : colors.panel;

  const logoShadow = Platform.select({
    web: { boxShadow: '0 12px 24px rgba(15,23,42,0.18)' },
    default: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      elevation: 10,
    },
  }) as Record<string, unknown>;

  const mounted = useRef(true);
  const [logoScale] = useState(() => new Animated.Value(0.8));
  const [logoOpacity] = useState(() => new Animated.Value(0));
  const [ripple1] = useState(() => new Animated.Value(0));
  const [ripple2] = useState(() => new Animated.Value(0));
  const [ripple3] = useState(() => new Animated.Value(0));

  const useNativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    mounted.current = true;

    const intro = Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver }),
      Animated.spring(logoScale, { toValue: 1, friction: 6, useNativeDriver }),
    ]);

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, { toValue: 1.08, duration: 900, useNativeDriver }),
        Animated.timing(logoScale, { toValue: 1, duration: 900, useNativeDriver }),
      ]),
      { iterations: 2 }
    );

    const ripple = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 2000, useNativeDriver }),
        ])
      );

    intro.start(() => {
      if (mounted.current) {
        pulse.start();
      }
    });

    const ripples = [ripple(ripple1, 0), ripple(ripple2, 500), ripple(ripple3, 1000)];
    ripples.forEach((r) => r.start());

    return () => {
      mounted.current = false;
      intro.stop();
      pulse.stop();
      ripples.forEach((r) => r.stop());
    };
  }, [logoOpacity, logoScale, ripple1, ripple2, ripple3, useNativeDriver]);

  const renderRipple = (value: Animated.Value, index: number) => {
    const scale = value.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.8] });
    const opacity = value.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.4, 0] });
    return (
      <Animated.View
        key={index}
        style={[
          styles.ripple,
          { opacity, transform: [{ scale }] },
        ]}
      />
    );
  };

  return (
    // Havasu Falls splash. The image uses `contain` so the whole photo is
    // always visible with no cropping and no overlay filter; flat panels
    // sampled from the photo's own top and bottom edges fill the space
    // above and below it. Once `ready`, any tap calls onContinue.
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={ready ? onContinue : undefined}
      disabled={!ready}
      accessibilityRole="button"
      accessibilityLabel={ready ? 'Tap anywhere to open the app' : 'Loading'}
    >
      <View style={StyleSheet.absoluteFill}>
        {horizontalBars ? (
          <>
            <View style={styles.fillTop} />
            <View style={styles.fillBottom} />
          </>
        ) : (
          <>
            <View style={styles.fillLeft} />
            <View style={styles.fillRight} />
          </>
        )}
        <Image
          source={require('@/assets/images/havasu-falls.jpg')}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          accessibilityLabel="Havasu Falls waterfall in the Grand Canyon, Arizona"
        />
      </View>
      <View style={styles.content} pointerEvents="none">
        <View style={styles.stage}>
          {renderRipple(ripple1, 0)}
          {renderRipple(ripple2, 1)}
          {renderRipple(ripple3, 2)}
          <Animated.View
            style={[
              styles.logoPanel,
              { backgroundColor: logoBg, opacity: logoOpacity, transform: [{ scale: logoScale }] },
              logoShadow,
            ]}
          >
            <Image source={require('@/assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
          </Animated.View>
        </View>

        <Animated.Text style={[styles.title, { opacity: logoOpacity }]}>Light Rail Deals</Animated.Text>
        <Animated.Text style={[styles.subtitle, { opacity: logoOpacity }]}>{ready ? 'Tap anywhere to continue' : message}</Animated.Text>
        {ready ? null : <ActivityIndicator color="rgba(255,255,255,0.9)" style={styles.spinner} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fillTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#a2795f',
  },
  fillBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#5e655d',
  },
  fillLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '50%',
    backgroundColor: '#8f7661',
  },
  fillRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '50%',
    backgroundColor: '#a86350',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  ripple: {
    position: 'absolute',
    top: 40,
    left: 40,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'transparent',
  },
  logoPanel: {
    width: 120,
    height: 120,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  spinner: {
    marginTop: 28,
  },
});
