import { useCallback, useMemo, useState } from 'react';
import { Image, RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { applyForTicket, listTickets } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { barcodeUrl } from '@/lib/qr';
import { useThemeColors } from '@/lib/useThemeColors';
import { AppButton, Banner, BrandHeader, Card, Pill, Screen, SectionTitle, Spinner } from '@/components/Ui';
import type { Ticket } from '@/lib/types';

function TicketCard({ ticket, colors }: { ticket: Ticket; colors: ReturnType<typeof useThemeColors> }) {
  const { width } = useWindowDimensions();
  const barcodeWidth = Math.min(width - 64, 360);
  return (
    <Card>
      <SectionTitle title={ticket.name} subtitle={ticket.status === 'active' ? `${ticket.remainingUses} of ${ticket.allowedUses} uses left` : 'Used'} />
      <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
        <Image source={{ uri: barcodeUrl(ticket.barcode, barcodeWidth, 120) }} style={{ width: barcodeWidth, height: 120, borderRadius: 8, backgroundColor: '#fff' }} resizeMode="contain" />
        <Text style={{ color: colors.ink, fontWeight: '700', letterSpacing: 1 }}>{ticket.barcode}</Text>
      </View>
      <Pill tone={ticket.status === 'active' ? 'success' : 'neutral'}>{ticket.status}</Pill>
      <Banner tone="info">Show this barcode at the event entrance. Staff will scan it.</Banner>
    </Card>
  );
}

export default function TicketsScreen() {
  const colors = useThemeColors();
  const auth = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ success: boolean; message: string; ticket?: Ticket } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setTickets(await listTickets());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load tickets');
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

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

  const { available, mine } = useMemo(() => {
    const available = tickets.filter((t) => !t.userId);
    const mine = tickets.filter((t) => t.userId && t.userId === auth.profile?.id);
    return { available, mine };
  }, [tickets, auth.profile?.id]);

  async function handleApply() {
    if (!auth.token) {
      setApplyResult({ success: false, message: 'Sign in to enter the drawing.' });
      return;
    }
    setApplying(true);
    setApplyResult(null);
    try {
      const ticket = await applyForTicket();
      setTickets((prev) => [ticket, ...prev]);
      setApplyResult({ success: true, message: `You won a ticket: ${ticket.name}`, ticket });
    } catch (err) {
      setApplyResult({ success: false, message: err instanceof Error ? err.message : 'Unable to enter drawing' });
    } finally {
      setApplying(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}>
        <BrandHeader subtitle="Event tickets & random drawings" />

        <Card>
          <SectionTitle title="Random drawing" subtitle="Enter to win an event ticket" />
          <Banner tone="info">All tickets are random drawing. Tap below to enter and a random available ticket will be assigned to you.</Banner>
          <AppButton onPress={() => void handleApply()} disabled={applying || available.length === 0}>
            {applying ? 'Entering…' : available.length === 0 ? 'No tickets available' : 'Enter drawing'}
          </AppButton>
          {applyResult ? (
            <Banner tone={applyResult.success ? 'success' : 'error'}>{applyResult.message}</Banner>
          ) : null}
        </Card>

        {loading ? <Spinner /> : null}
        {error ? <Banner tone="error">{error}</Banner> : null}

        {!loading && mine.length > 0 ? (
          <Card>
            <SectionTitle title="My tickets" subtitle={`${mine.length} ticket${mine.length === 1 ? '' : 's'}`} />
            {mine.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} colors={colors} />
            ))}
          </Card>
        ) : null}

        {!loading && available.length > 0 ? (
          <Card>
            <SectionTitle title="Open drawings" subtitle={`${available.length} ticket${available.length === 1 ? '' : 's'} remaining`} />
            {available.map((ticket) => (
              <View key={ticket.id} style={{ padding: 12, borderRadius: 12, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.ink, fontWeight: '700' }}>{ticket.name}</Text>
                <Text style={{ color: colors.muted }}>{ticket.remainingUses} use{ticket.remainingUses === 1 ? '' : 's'} left</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {!loading && tickets.length === 0 ? <Banner tone="info">No event tickets available right now.</Banner> : null}
      </ScrollView>
    </Screen>
  );
}
