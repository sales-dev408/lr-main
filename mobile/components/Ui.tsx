import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type TextInputProps, type ViewProps } from 'react-native';
import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';
import { APPLE_TRADEMARK_NOTICE } from '@/lib/theme';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';

function useUiStyles() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();

  return useMemo(() => {
    const multiplier = effectiveScale;
    const scale = (size: number) => size * multiplier;
    const cardShadow = (Platform.OS === 'web'
      ? { boxShadow: `0 20px 50px ${colors.ink}1a`, elevation: 10 }
      : { ...colors.shadow }) as Record<string, unknown>;

    return StyleSheet.create({
      screen: {
        flex: 1,
        backgroundColor: colors.bg,
        padding: 16 * multiplier,
        gap: 12,
      },
      brandHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 4,
      },
      brandLogo: {
        width: 44 * multiplier,
        height: 44 * multiplier,
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
        fontSize: scale(15),
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
  }, [colors, effectiveScale]);
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
        <Text style={styles.brandTitle} accessibilityRole="header" allowFontScaling={false}>Light Rail Deals</Text>
        {subtitle ? <Text style={styles.brandSubtitle} allowFontScaling={false}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function AppleTrademark() {
  const styles = useUiStyles();
  return <Text style={styles.appleTrademark} allowFontScaling={false}>{APPLE_TRADEMARK_NOTICE}</Text>;
}

export function Screen({ children, accessibilityLabel, ...props }: ViewProps & { accessibilityLabel?: string }) {
  const styles = useUiStyles();
  const ref = useRef<View>(null);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (Platform.OS !== 'web' || !ref.current) return;
        const node = ref.current as unknown as HTMLElement;
        const active = document.activeElement as HTMLElement | null;
        if (active && node.contains(active)) {
          active.blur();
        }
      };
    }, []),
  );

  return (
    <View ref={ref} style={styles.screen} accessibilityLabel={accessibilityLabel} {...props}>
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
      <Text style={styles.sectionTitle} allowFontScaling={false}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle} allowFontScaling={false}>{subtitle}</Text> : null}
    </View>
  );
}

export function AppButton({
  children,
  variant = 'primary',
  style,
  accessibilityLabel,
  accessibilityHint,
  disabled,
  ...props
}: PressableProps & { children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; style?: ViewProps['style']; accessibilityLabel?: string; accessibilityHint?: string; disabled?: boolean }) {
  const styles = useUiStyles();
  const label = accessibilityLabel ?? textFromChildren(children);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.button_primary,
        variant === 'secondary' && styles.button_secondary,
        variant === 'ghost' && styles.button_ghost,
        variant === 'danger' && styles.button_danger,
        pressed && !disabled && styles.buttonPressed,
        style,
      ]}
      {...props}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'secondary' || variant === 'ghost' ? styles.buttonTextDark : null,
          disabled ? { opacity: 0.5 } : null,
        ]}
        allowFontScaling={false}
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
      allowFontScaling={false}
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
      <Text style={styles.bannerText} allowFontScaling={false}>{children}</Text>
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
      <Text style={styles.pillText} allowFontScaling={false}>{children}</Text>
    </View>
  );
}

export function Spinner() {
  const colors = useThemeColors();
  return <ActivityIndicator color={colors.brand} accessibilityLabel="Loading" />;
}
