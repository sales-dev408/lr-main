import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View, type PressableProps, type TextInputProps, type ViewProps } from 'react-native';
import { useMemo, type ReactNode } from 'react';
import { APPLE_TRADEMARK_NOTICE } from '@/lib/theme';
import { useThemeColors } from '@/lib/useThemeColors';

const MAX_FONT_MULTIPLIER = 1.3;

function useUiStyles() {
  const colors = useThemeColors();
  const { fontScale } = useWindowDimensions();

  return useMemo(() => {
    const multiplier = Math.min(fontScale, MAX_FONT_MULTIPLIER);
    const scale = (size: number) => size * multiplier;
    const cardShadow = (Platform.OS === 'web'
      ? { boxShadow: `0 20px 50px ${colors.ink}1a`, elevation: 10 }
      : { ...colors.shadow }) as Record<string, unknown>;

    return StyleSheet.create({
      screen: {
        flex: 1,
        backgroundColor: colors.bg,
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
        backgroundColor: colors.panel,
      },
      brandTitle: {
        fontSize: scale(22),
        fontWeight: '800',
        color: colors.ink,
        letterSpacing: 0.2,
      },
      brandSubtitle: {
        fontSize: scale(13),
        color: colors.muted,
      },
      appleTrademark: {
        fontSize: scale(11),
        lineHeight: scale(15),
        color: colors.subtle,
      },
      card: {
        backgroundColor: colors.panel,
        borderRadius: colors.radius,
        padding: 18,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 14,
        ...cardShadow,
      },
      sectionHeader: {
        gap: 4,
      },
      sectionTitle: {
        fontSize: scale(22),
        fontWeight: '700',
        color: colors.ink,
      },
      sectionSubtitle: {
        fontSize: scale(14),
        color: colors.muted,
      },
      button: {
        borderRadius: 16,
        paddingVertical: 13,
        paddingHorizontal: 18,
        alignItems: 'center',
        justifyContent: 'center',
      },
      button_primary: { backgroundColor: colors.brand },
      button_secondary: { backgroundColor: colors.brandSoft },
      button_ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
      button_danger: { backgroundColor: colors.danger },
      buttonPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
      buttonText: { color: '#fff', fontWeight: '700', fontSize: scale(15) },
      buttonTextDark: { color: colors.ink },
      input: {
        backgroundColor: colors.panel,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        paddingHorizontal: 15,
        paddingVertical: 13,
        color: colors.ink,
      },
      banner: {
        borderRadius: 16,
        padding: 13,
      },
      banner_info: { backgroundColor: colors.infoSoft },
      banner_error: { backgroundColor: colors.dangerSoft },
      banner_success: { backgroundColor: colors.successSoft },
      bannerText: {
        color: colors.ink,
      },
      pill: {
        borderRadius: 999,
        paddingVertical: 7,
        paddingHorizontal: 12,
        alignSelf: 'flex-start',
      },
      pill_neutral: { backgroundColor: colors.brandSoft },
      pill_success: { backgroundColor: colors.successSoft },
      pill_warning: { backgroundColor: colors.warningSoft },
      pillText: {
        fontSize: scale(13),
        fontWeight: '700',
        color: colors.ink,
      },
    });
  }, [colors, fontScale]);
}

function textFromChildren(children: ReactNode): string | undefined {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(textFromChildren).filter(Boolean).join(' ') || undefined;
  return undefined;
}

export function BrandHeader({ subtitle }: { subtitle?: string }) {
  const styles = useUiStyles();
  return (
    <View style={styles.brandHeader} accessibilityRole="header" accessibilityLabel="Light Rail Deals">
      <Image source={require('@/assets/images/logo.png')} style={styles.brandLogo} resizeMode="contain" accessibilityLabel="Light Rail Deals logo" />
      <View style={{ flex: 1 }}>
        <Text style={styles.brandTitle} accessibilityRole="header">Light Rail Deals</Text>
        {subtitle ? <Text style={styles.brandSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function AppleTrademark() {
  const styles = useUiStyles();
  return <Text style={styles.appleTrademark}>{APPLE_TRADEMARK_NOTICE}</Text>;
}

export function Screen({ children, accessibilityLabel, ...props }: ViewProps & { accessibilityLabel?: string }) {
  const styles = useUiStyles();
  return (
    <View style={styles.screen} accessibilityLabel={accessibilityLabel} {...props}>
      {children}
    </View>
  );
}

export function Card({ children, accessibilityLabel }: { children: ReactNode; accessibilityLabel?: string }) {
  const styles = useUiStyles();
  return (
    <View style={styles.card} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const styles = useUiStyles();
  return (
    <View style={styles.sectionHeader} accessibilityRole="header" accessibilityLabel={title}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function AppButton({
  children,
  variant = 'primary',
  style,
  accessibilityLabel,
  accessibilityHint,
  ...props
}: PressableProps & { children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; style?: ViewProps['style']; accessibilityLabel?: string; accessibilityHint?: string }) {
  const styles = useUiStyles();
  const label = accessibilityLabel ?? textFromChildren(children);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      tabIndex={-1}
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
        maxFontSizeMultiplier={MAX_FONT_MULTIPLIER}
      >
        {children}
      </Text>
    </Pressable>
  );
}

export function FieldInput(props: TextInputProps) {
  const styles = useUiStyles();
  const placeholder = props.placeholder;
  return (
    <TextInput
      placeholderTextColor="#7c8a9d"
      accessibilityRole="text"
      accessibilityLabel={props.accessibilityLabel ?? placeholder ?? 'Input'}
      style={styles.input}
      maxFontSizeMultiplier={MAX_FONT_MULTIPLIER}
      {...props}
    />
  );
}

export function Banner({ children, tone = 'info', accessibilityLabel }: { children: ReactNode; tone?: 'info' | 'error' | 'success'; accessibilityLabel?: string }) {
  const styles = useUiStyles();
  const label = accessibilityLabel ?? textFromChildren(children);
  return (
    <View
      style={[styles.banner, tone === 'info' && styles.banner_info, tone === 'error' && styles.banner_error, tone === 'success' && styles.banner_success]}
      accessibilityRole="alert"
      accessibilityLabel={label}
    >
      <Text style={styles.bannerText} maxFontSizeMultiplier={MAX_FONT_MULTIPLIER}>{children}</Text>
    </View>
  );
}

export function Pill({ children, tone = 'neutral', accessibilityLabel }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning'; accessibilityLabel?: string }) {
  const styles = useUiStyles();
  const label = accessibilityLabel ?? textFromChildren(children);
  return (
    <View
      style={[styles.pill, tone === 'neutral' && styles.pill_neutral, tone === 'success' && styles.pill_success, tone === 'warning' && styles.pill_warning]}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <Text style={styles.pillText} maxFontSizeMultiplier={MAX_FONT_MULTIPLIER}>{children}</Text>
    </View>
  );
}

export function Spinner() {
  const colors = useThemeColors();
  return <ActivityIndicator color={colors.brand} accessibilityLabel="Loading" />;
}
