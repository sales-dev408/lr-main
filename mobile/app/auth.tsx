import { useMemo, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton, Banner, Card, FieldInput, Screen, SectionTitle } from '@/components/Ui';
import { useAdmin } from '@/lib/admin';
import { useAuth } from '@/lib/auth';

type Mode = 'login' | 'register';

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const auth = useAuth();
  const admin = useAdmin();
  const [mode, setMode] = useState<Mode>(params.mode === 'register' ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submitLabel = useMemo(() => (mode === 'login' ? 'Log in' : 'Create account'), [mode]);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'login') {
        // The first/last-name boxes double as the admin credential gateway:
        // if they match the credentials configured in the admin dashboard, the
        // server issues an admin token and in-app editing unlocks.
        if (firstName.trim() && lastName.trim()) {
          try {
            await admin.unlock({ email: firstName.trim(), password: lastName });
            router.replace('/(tabs)/discover');
            return;
          } catch {
            // Not admin credentials — fall through to the member login below.
          }
        }
        await auth.loginWithPassword({
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
          password,
        });
      } else {
        const first = firstName.trim();
        const last = lastName.trim();
        await auth.registerAccount({
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
          password,
          fullName: [first, last].filter(Boolean).join(' ') || 'Customer',
          ...(first ? { firstName: first } : {}),
          ...(last ? { lastName: last } : {}),
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
            title={mode === 'register' ? 'Create your membership' : 'Sign in'}
            subtitle={mode === 'register' ? 'Your membership pass is generated as soon as you sign up.' : 'Email or phone + password.'}
          />
          {error ? <Banner tone="error">{error}</Banner> : null}
          <FieldInput value={firstName} onChangeText={setFirstName} placeholder="First name" autoCapitalize="words" />
          <FieldInput value={lastName} onChangeText={setLastName} placeholder="Last name" autoCapitalize="words" secureTextEntry={mode === 'login'} />
          {mode === 'login' ? (
            <Text style={{ color: '#7c8a9d', fontSize: 12 }}>Admins: enter your dashboard credentials here to unlock in-app editing.</Text>
          ) : null}
          <FieldInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" />
          <FieldInput value={phone} onChangeText={setPhone} placeholder="Phone" autoCapitalize="none" keyboardType="phone-pad" textContentType="telephoneNumber" />
          <FieldInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
          <AppButton onPress={() => void submit()}>{loading ? 'Working…' : submitLabel}</AppButton>
          <AppButton variant="secondary" onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
            Switch to {mode === 'login' ? 'register' : 'login'}
          </AppButton>
          <AppButton
            variant="ghost"
            onPress={() =>
              void (async () => {
                setLoading(true);
                setError(null);
                try {
                  await auth.loginWithSocial();
                  router.replace('/(tabs)');
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Social sign in failed');
                } finally {
                  setLoading(false);
                }
              })()
            }
          >
            Continue with social
          </AppButton>
        </Card>

        <Card>
          <SectionTitle title="What happens next" subtitle="One membership pass unlocks every participating business." />
          <Text style={{ color: '#52617a' }}>
            After signing up we generate your personal membership pass and add it to Apple Wallet or Google Wallet. Show its barcode at any participating business and
            they apply their member discount at the register. Your phone number is stored securely and only used to sign you in.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}
