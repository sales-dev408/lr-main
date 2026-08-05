import React, { useMemo, useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton, Banner, Card, FieldInput, Screen, SectionTitle } from '@/components/Ui';
import { useAuth } from '@/lib/auth';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';
import { EULA_URL, PRIVACY_URL, TERMS_URL } from '@/lib/theme';

type Mode = 'login' | 'register';

function isEmail(value: string) {
  return value.includes('@');
}

function CheckRow({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: ReactNode }) {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const size = 22 * effectiveScale;
  return (
    <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 4,
          borderWidth: 2,
          borderColor: colors.brand,
          backgroundColor: checked ? colors.brand : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <Text style={{ color: '#fff', fontSize: 13 * effectiveScale, fontWeight: '700' }} allowFontScaling={false}>✓</Text> : null}
      </View>
      <Text style={{ flex: 1, color: colors.ink, fontSize: 14 * effectiveScale, lineHeight: 20 * effectiveScale }} allowFontScaling={false}>
        {label}
      </Text>
    </Pressable>
  );
}

function LinkText({ url, children }: { url: string; children: ReactNode }) {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  return (
    <Text onPress={() => void Linking.openURL(url)} style={{ color: colors.brand, textDecorationLine: 'underline', fontSize: 14 * effectiveScale }} allowFontScaling={false}>
      {children}
    </Text>
  );
}

export default function AuthScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const auth = useAuth();
  const { effectiveScale } = useDynamicType();
  const [mode, setMode] = useState<Mode>(params.mode === 'register' ? 'register' : 'login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [promoOptIn, setPromoOptIn] = useState(false);
  const [legalOptIn, setLegalOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submitLabel = useMemo(() => (mode === 'login' ? 'Sign In' : 'Create account'), [mode]);

  function resetForm() {
    setError(null);
    setFirstName('');
    setLastName('');
    setIdentifier('');
    setEmail('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setPromoOptIn(false);
    setLegalOptIn(false);
  }

  function toggleMode() {
    setMode(mode === 'login' ? 'register' : 'login');
    resetForm();
  }

  async function submit() {
    setError(null);
    if (mode === 'register') {
      const first = firstName.trim();
      const last = lastName.trim();
      if (!first || !last) {
        setError('First and last name are required.');
        return;
      }
      if (!email.trim() && !phone.trim()) {
        setError('Email or phone is required for registration.');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (!legalOptIn) {
        setError('You must accept the Terms of Use, Privacy Policy, and EULA to register.');
        return;
      }
    } else {
      if (!identifier.trim()) {
        setError('Email or phone is required to sign in.');
        return;
      }
      if (!password) {
        setError('Password is required.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        await auth.registerAccount({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          password,
          promoEmailOptIn: promoOptIn,
          promoSmsOptIn: promoOptIn,
          termsAccepted: legalOptIn,
          privacyAccepted: legalOptIn,
          eulaAccepted: legalOptIn,
        });
      } else {
        const trimmed = identifier.trim();
        await auth.signIn({
          ...(isEmail(trimmed) ? { email: trimmed } : { phone: trimmed }),
          password,
        });
      }
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
        <Card>
          <SectionTitle
            title={mode === 'register' ? 'Create your membership' : 'Sign In'}
            subtitle={mode === 'register' ? 'Your membership pass is generated as soon as you sign up.' : 'Enter your email or phone and password.'}
          />
          {error ? <Banner tone="error">{error}</Banner> : null}

          {mode === 'register' ? (
            <>
              <FieldInput value={firstName} onChangeText={setFirstName} placeholder="First name" autoCapitalize="words" />
              <FieldInput value={lastName} onChangeText={setLastName} placeholder="Last name" autoCapitalize="words" />
            </>
          ) : null}

          {mode === 'login' ? (
            <FieldInput
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="Email or phone"
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              accessibilityLabel="Email or phone"
            />
          ) : (
            <>
              <FieldInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                accessibilityLabel="Email"
              />
              <FieldInput
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone"
                autoCapitalize="none"
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                accessibilityLabel="Phone"
              />
            </>
          )}

          <FieldInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            autoCapitalize="none"
            secureTextEntry
            textContentType={mode === 'register' ? 'newPassword' : 'password'}
            accessibilityLabel="Password"
          />

          {mode === 'register' ? (
            <>
              <FieldInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm password"
                autoCapitalize="none"
                secureTextEntry
                textContentType="newPassword"
                accessibilityLabel="Confirm password"
              />
              <CheckRow
                checked={promoOptIn}
                onToggle={() => setPromoOptIn((v) => !v)}
                label="Opt in to promotional emails and text messages (including the Deal of the Day email blast)."
              />
              <CheckRow
                checked={legalOptIn}
                onToggle={() => setLegalOptIn((v) => !v)}
                label={
                  <>
                    I accept the <LinkText url={TERMS_URL}>Terms of Use</LinkText>,{' '}
                    <LinkText url={PRIVACY_URL}>Privacy Policy</LinkText>, and{' '}
                    <LinkText url={EULA_URL}>End User License Agreement</LinkText>.
                  </>
                }
              />
            </>
          ) : null}

          <View style={{ gap: 12, alignItems: 'center', width: '100%' }}>
            <AppButton
              onPress={() => void submit()}
              disabled={loading}
              style={{ minWidth: 280, width: '100%', maxWidth: 360, paddingVertical: 16 }}
            >
              {loading ? 'Working…' : submitLabel}
            </AppButton>
            <AppButton
              variant="secondary"
              onPress={toggleMode}
              disabled={loading}
              style={{ minWidth: 280, width: '100%', maxWidth: 360, paddingVertical: 16 }}
            >
              Switch to {mode === 'login' ? 'register' : 'sign in'}
            </AppButton>
          </View>
        </Card>

        <Card>
          <SectionTitle title="What happens next" subtitle="One membership pass unlocks every participating business." />
          <Text style={{ color: colors.muted, fontSize: 14 * effectiveScale, lineHeight: 20 * effectiveScale }} allowFontScaling={false}>
            After signing up we generate your personal membership pass. Show its barcode at any participating business and they apply their member discount at the
            register. Your phone number is stored securely and only used to contact you about your account.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}
