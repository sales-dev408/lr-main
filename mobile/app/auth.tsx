import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton, Banner, Card, FieldInput, Screen, SectionTitle } from '@/components/Ui';
import { useAuth } from '@/lib/auth';
import { useThemeColors } from '@/lib/useThemeColors';

type Mode = 'login' | 'register';

function isEmail(value: string) {
  return value.includes('@');
}

export default function AuthScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>(params.mode === 'register' ? 'register' : 'login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
            <FieldInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm password"
              autoCapitalize="none"
              secureTextEntry
              textContentType="newPassword"
              accessibilityLabel="Confirm password"
            />
          ) : null}

          <View style={{ gap: 12, alignItems: 'center', width: '100%' }}>
            <AppButton
              onPress={() => void submit()}
              style={{ minWidth: 280, width: '100%', maxWidth: 360, paddingVertical: 16 }}
            >
              {loading ? 'Working…' : submitLabel}
            </AppButton>
            <AppButton
              variant="secondary"
              onPress={toggleMode}
              style={{ minWidth: 280, width: '100%', maxWidth: 360, paddingVertical: 16 }}
            >
              Switch to {mode === 'login' ? 'register' : 'sign in'}
            </AppButton>
          </View>
        </Card>

        <Card>
          <SectionTitle title="What happens next" subtitle="One membership pass unlocks every participating business." />
          <Text style={{ color: colors.muted }}>
            After signing up we generate your personal membership pass. Show its barcode at any participating business and they apply their member discount at the
            register. Your phone number is stored securely and only used to contact you about your account.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}
