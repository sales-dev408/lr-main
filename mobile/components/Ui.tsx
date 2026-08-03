import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type TextInputProps, type ViewProps } from 'react-native';
import type { ReactNode } from 'react';
import { APPLE_TRADEMARK_NOTICE, theme } from '@/lib/theme';

export function BrandHeader({ subtitle }: { subtitle?: string }) {
  return (
    <View style={styles.brandHeader}>
      <Image source={require('@/assets/images/logo.png')} style={styles.brandLogo} resizeMode="contain" />
      <View style={{ flex: 1 }}>
        <Text style={styles.brandTitle}>Light Rail Deals</Text>
        {subtitle ? <Text style={styles.brandSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function AppleTrademark() {
  return <Text style={styles.appleTrademark}>{APPLE_TRADEMARK_NOTICE}</Text>;
}

export function Screen({ children, ...props }: ViewProps) {
  return (
    <View style={styles.screen} {...props}>
      {children}
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function AppButton({ children, variant = 'primary', style, ...props }: PressableProps & { children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; style?: ViewProps['style'] }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.button_primary,
        variant === 'secondary' && styles.button_secondary,
        variant === 'ghost' && styles.button_ghost,
        variant === 'danger' && styles.button_danger,
        pressed && styles.buttonPressed,
        style,
      ]}
      {...props}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'secondary' || variant === 'ghost' ? styles.buttonTextDark : null,
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

export function FieldInput(props: TextInputProps) {
  return <TextInput placeholderTextColor="#7c8a9d" style={styles.input} {...props} />;
}

export function Banner({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'error' | 'success' }) {
  return (
    <View style={[styles.banner, tone === 'info' && styles.banner_info, tone === 'error' && styles.banner_error, tone === 'success' && styles.banner_success]}>
      <Text style={styles.bannerText}>{children}</Text>
    </View>
  );
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' }) {
  return (
    <View style={[styles.pill, tone === 'neutral' && styles.pill_neutral, tone === 'success' && styles.pill_success, tone === 'warning' && styles.pill_warning]}>
      <Text style={styles.pillText}>{children}</Text>
    </View>
  );
}

export function Spinner() {
  return <ActivityIndicator color={theme.brand} />;
}

// react-native-web deprecates the iOS-only shadow* props; use CSS box-shadow on web.
const cardShadow = (Platform.OS === 'web'
  ? { boxShadow: '0 8px 24px rgba(11, 31, 42, 0.08)', elevation: 8 }
  : theme.shadow) as Record<string, unknown>;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
    padding: 16,
    gap: 12,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  brandLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.ink,
    letterSpacing: 0.2,
  },
  brandSubtitle: {
    fontSize: 13,
    color: theme.muted,
  },
  appleTrademark: {
    fontSize: 11,
    lineHeight: 15,
    color: theme.subtle,
  },
  card: {
    backgroundColor: theme.panel,
    borderRadius: theme.radius,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 12,
    ...cardShadow,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.ink,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: theme.muted,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button_primary: { backgroundColor: theme.brand },
  button_secondary: { backgroundColor: theme.brandSoft },
  button_ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.border },
  button_danger: { backgroundColor: theme.danger },
  buttonPressed: { opacity: 0.86 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  buttonTextDark: { color: theme.ink },
  input: {
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.ink,
  },
  banner: {
    borderRadius: 14,
    padding: 12,
  },
  banner_info: { backgroundColor: theme.brandSoft },
  banner_error: { backgroundColor: '#fde8e8' },
  banner_success: { backgroundColor: '#e6f8ef' },
  bannerText: {
    color: theme.ink,
  },
  pill: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  pill_neutral: { backgroundColor: '#eef3f9' },
  pill_success: { backgroundColor: '#def7e9' },
  pill_warning: { backgroundColor: '#fff1d9' },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.ink,
  },
});
