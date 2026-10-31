import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppColorScheme } from '@/lib/colorScheme';
import { useThemeColors } from '@/lib/useThemeColors';

export function LoadingScreen({ message = 'Loading your guide…', ready = false, onContinue }: { message?: string; ready?: boolean; onContinue?: () => void }) {
  const { scheme } = useAppColorScheme();
  const colors = useThemeColors();

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
    // Havasu Falls splash. The photo fills the entire background (cover) on
    // every screen size; a bottom gradient scrim keeps the logo, title, and
    // spinner readable while the falls stays visible above them. Once
    // `ready`, any tap calls onContinue.
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={ready ? onContinue : undefined}
      disabled={!ready}
      accessibilityRole="button"
      accessibilityLabel={ready ? 'Tap anywhere to open the app' : 'Loading'}
    >
      <View style={styles.backdrop}>
        <Image
          source={require('@/assets/images/havasu-falls.jpg')}
          style={styles.photo}
          resizeMode="cover"
          accessibilityLabel="Havasu Falls waterfall in the Grand Canyon, Arizona"
        />
        <LinearGradient
          colors={['rgba(23,20,18,0)', 'rgba(23,20,18,0.55)', '#171412']}
          locations={[0, 0.5, 1]}
          style={styles.scrim}
          pointerEvents="none"
        />
        <View style={styles.dock} pointerEvents="none">
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
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#171412',
  },
  photo: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '58%',
  },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 8,
  },
  stage: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  ripple: {
    position: 'absolute',
    top: 25,
    left: 25,
    width: 110,
    height: 110,
    borderRadius: 55,
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
