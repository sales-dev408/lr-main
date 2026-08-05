import { useCallback, useMemo, useState } from 'react';
import { Image, RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { enterTicketDrawing, listTickets } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { barcodeUrl } from '@/lib/qr';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';
import { AppButton, Banner, BrandHeader, Card, Pill, Screen, SectionTitle, Spinner } from '@/components/Ui';
import type { Ticket } from '@/lib/types';

function TicketCard({ ticket, colors }: { ticket: Ticket; colors: ReturnType<typeof useThemeColors> }) {
  const { width } = useWindowDimensions();
  const { effectiveScale } = useDynamicType();
  const barcodeWidth = Math.min(width - 64, 360);
  return (
    <Card>
      <SectionTitle title={ticket.name} subtitle={ticket.status === 'active' ? `${ticket.remainingUses} of ${ticket.allowedUses} uses left` : 'Used'} />
      <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
        <Image source={{ uri: barcodeUrl(ticket.barcode, barcodeWidth, 120) }} style={{ width: barcodeWidth, height: 120, borderRadius: 8, backgroundColor: '#fff' }} resizeMode="contain" />
        <Text style={{ color: colors.ink, fontWeight: '700', letterSpacing: 1, fontSize: 14 * effectiveScale }} allowFontScaling={false}>{ticket.barcode}</Text>
      </View>
      <Pill tone={ticket.status === 'active' ? 'success' : 'neutral'}>{ticket.status}</Pill>
      <Banner tone="info">Show this barcode at the event entrance. Staff will scan it.</Banner>
    </Card>
  );
}

function formatDeadline(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function TicketsScreen() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const auth = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [count, setCount] = useState(1);
  const [entering, setEntering] = useState(false);
  const [enterResult, setEnterResult] = useState<{ success: boolean; message: string } | null>(null);
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

  const { open, mine } = useMemo(() => {
    const open = tickets.filter((t) => t.drawingStatus === 'open');
    const mine = tickets.filter((t) => t.userId && t.userId === auth.profile?.id);
    return { open, mine };
  }, [tickets, auth.profile?.id]);

  function adjustCount(delta: number) {
    setCount((c) => Math.min(4, Math.max(1, c + delta)));
  }

  async function handleEnter(ticketId: string) {
    if (!auth.token) {
      setEnterResult({ success: false, message: 'Sign in to enter the drawing.' });
      return;
    }
    setEntering(true);
    setEnterResult(null);
    try {
      await enterTicketDrawing(ticketId, count);
      setEnterResult({ success: true, message: `You entered with ${count} ticket${count === 1 ? '' : 's'}. Good luck!` });
      setCount(1);
      setSelectedTicketId(null);
      await load();
    } catch (err) {
      setEnterResult({ success: false, message: err instanceof Error ? err.message : 'Unable to enter drawing' });
    } finally {
      setEntering(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}>
        <BrandHeader subtitle="Event tickets & random drawings" />

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

        {!loading && open.length > 0 ? (
          <Card>
            <SectionTitle title="Open drawings" subtitle={`${open.length} drawing${open.length === 1 ? '' : 's'} open`} />
            {open.map((ticket) => (
              <View key={ticket.id} style={{ padding: 14, borderRadius: 16, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 16 * effectiveScale }} allowFontScaling={false}>{ticket.name}</Text>
                  <Pill tone={ticket.entryCount ? 'success' : 'neutral'}>{ticket.entryCount ? `${ticket.entryCount} entries` : 'Not entered'}</Pill>
                </View>
                {ticket.drawingDeadline ? <Text style={{ color: colors.muted, fontSize: 14 * effectiveScale }} allowFontScaling={false}>Deadline: {formatDeadline(ticket.drawingDeadline)}</Text> : null}

                {selectedTicketId === ticket.id ? (
                  <View style={{ gap: 10 }}>
                    <Text style={{ color: colors.ink, fontSize: 14 * effectiveScale }} allowFontScaling={false}>Number of tickets to request (1–4)</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                      <AppButton variant="secondary" onPress={() => adjustCount(-1)} style={{ width: 50 }}>
                        –
                      </AppButton>
                      <Text style={{ color: colors.ink, fontSize: 22 * effectiveScale, fontWeight: '800', minWidth: 32, textAlign: 'center' }} allowFontScaling={false}>{count}</Text>
                      <AppButton variant="secondary" onPress={() => adjustCount(1)} style={{ width: 50 }}>
                        +
                      </AppButton>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <AppButton variant="ghost" onPress={() => setSelectedTicketId(null)}>
                          Cancel
                        </AppButton>
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppButton onPress={() => void handleEnter(ticket.id)} disabled={entering}>
                          {entering ? 'Submitting…' : 'Submit'}
                        </AppButton>
                      </View>
                    </View>
                  </View>
                ) : (
                  <AppButton onPress={() => setSelectedTicketId(ticket.id)}>
                    Enter drawing
                  </AppButton>
                )}
              </View>
            ))}
          </Card>
        ) : null}

        {enterResult ? <Banner tone={enterResult.success ? 'success' : 'error'}>{enterResult.message}</Banner> : null}

        {!loading && tickets.length === 0 ? <Banner tone="info">No event tickets or drawings available right now.</Banner> : null}
      </ScrollView>
    </Screen>
  );
}
