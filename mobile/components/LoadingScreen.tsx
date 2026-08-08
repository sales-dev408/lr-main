import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppColorScheme } from '@/lib/colorScheme';
import { useAppTheme } from '@/lib/appTheme';
import { useThemeColors } from '@/lib/useThemeColors';

export function LoadingScreen({ message = 'Loading your deals…' }: { message?: string }) {
  const { scheme } = useAppColorScheme();
  const { theme } = useAppTheme();
  const colors = useThemeColors();

  const isDark = scheme === 'dark';
  const logoBg = isDark ? colors.ink : colors.panel;

  const mounted = useRef(true);
  const [logoScale] = useState(() => new Animated.Value(0.8));
  const [logoOpacity] = useState(() => new Animated.Value(0));
  const [ripple1] = useState(() => new Animated.Value(0));
  const [ripple2] = useState(() => new Animated.Value(0));
  const [ripple3] = useState(() => new Animated.Value(0));

  useEffect(() => {
    mounted.current = true;

    const intro = Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]);

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );

    const ripple = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 2000, useNativeDriver: true }),
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
  }, [logoOpacity, logoScale, ripple1, ripple2, ripple3]);

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
    <LinearGradient colors={theme.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
      <View style={styles.content}>
        <View style={styles.stage}>
          {renderRipple(ripple1, 0)}
          {renderRipple(ripple2, 1)}
          {renderRipple(ripple3, 2)}
          <Animated.View
            style={[
              styles.logoPanel,
              { backgroundColor: logoBg, opacity: logoOpacity, transform: [{ scale: logoScale }] },
            ]}
          >
            <Image source={require('@/assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
          </Animated.View>
        </View>

        <Animated.Text style={[styles.title, { opacity: logoOpacity }]}>Light Rail Deals</Animated.Text>
        <Animated.Text style={[styles.subtitle, { opacity: logoOpacity }]}>{message}</Animated.Text>
        <ActivityIndicator color="rgba(255,255,255,0.9)" style={styles.spinner} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
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
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
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
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  spinner: {
    marginTop: 28,
  },
});
