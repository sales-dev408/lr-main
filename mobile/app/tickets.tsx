import { useCallback, useState } from 'react';
import { Image, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { AppButton, Banner, BrandHeader, Card, Screen, SectionTitle, Spinner } from '@/components/Ui';
import { listTickets } from '@/lib/api';
import { qrCodeUrl } from '@/lib/qr';
import type { Ticket } from '@/lib/types';

function ticketQrUrl(text: string) {
  return qrCodeUrl(text, 240);
}

export default function TicketsScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setTickets(await listTickets());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load tickets');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      void load().finally(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: 'My Tickets' }} />
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}>
        <BrandHeader subtitle="Your event tickets" />

        {loading ? <Spinner /> : null}
        {error ? <Banner tone="error">{error}</Banner> : null}
        {!loading && tickets.length === 0 ? <Banner tone="info">No event tickets yet.</Banner> : null}

        {tickets.map((ticket) => (
          <Card key={ticket.id}>
            <SectionTitle title={ticket.name} subtitle={ticket.status === 'active' ? `${ticket.remainingUses} of ${ticket.allowedUses} uses left` : 'Used'} />
            <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
              <Image source={{ uri: ticketQrUrl(ticket.barcode) }} style={{ width: 240, height: 240, borderRadius: 8, backgroundColor: '#fff' }} resizeMode="contain" />
              <Text style={{ color: '#10223d', fontWeight: '700', letterSpacing: 1 }}>{ticket.barcode}</Text>
            </View>
            <Banner tone="info">Show this QR code at the event entrance. Staff will scan it.</Banner>
          </Card>
        ))}

        <AppButton variant="secondary" onPress={() => void onRefresh()}>
          Refresh tickets
        </AppButton>
        <AppButton variant="ghost" onPress={() => router.push('/(tabs)')}>
          Back to home
        </AppButton>
      </ScrollView>
    </Screen>
  );
}
