import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton, Banner, Card, FieldInput, Screen, SectionTitle } from '@/components/Ui';
import { useAuth } from '@/lib/auth';
import { useThemeColors } from '@/lib/useThemeColors';

type Mode = 'login' | 'register';

export default function AuthScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>(params.mode === 'register' ? 'register' : 'login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submitLabel = useMemo(() => (mode === 'login' ? 'Sign In' : 'Create account'), [mode]);

  async function submit() {
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || !last) {
      setError('First and last name are required.');
      return;
    }
    if (mode === 'register' && (!email.trim() || !phone.trim())) {
      setError('Email and phone are required for registration.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (mode === 'register') {
        await auth.registerAccount({
          firstName: first,
          lastName: last,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        });
      } else {
        await auth.signIn({ firstName: first, lastName: last });
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
            subtitle={mode === 'register' ? 'Your membership pass is generated as soon as you sign up.' : 'Enter your first and last name.'}
          />
          {error ? <Banner tone="error">{error}</Banner> : null}
          <FieldInput value={firstName} onChangeText={setFirstName} placeholder="First name" autoCapitalize="words" />
          <FieldInput value={lastName} onChangeText={setLastName} placeholder="Last name" autoCapitalize="words" />
          {mode === 'register' ? (
            <>
              <FieldInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" />
              <FieldInput value={phone} onChangeText={setPhone} placeholder="Phone" autoCapitalize="none" keyboardType="phone-pad" textContentType="telephoneNumber" />
            </>
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
              onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
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
