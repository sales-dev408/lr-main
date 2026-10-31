import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { AppButton, Banner, BrandHeader, Card, Pill, Screen, SectionTitle } from '@/components/Ui';
import { useAuth } from '@/lib/auth';
import {
  clearInbox,
  markAllInboxRead,
  markInboxRead,
  useNotificationInbox,
} from '@/lib/notificationInbox';
import { setNotificationsMuted } from '@/lib/notifications';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';

function formatReceivedAt(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today · ${time}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday · ${time}`;
  return `${d.toLocaleDateString()} · ${time}`;
}

// Notification inbox + mute controls. Every push notification that reaches
// the device while the app runs is mirrored here (lib/notificationInbox.ts).
// Muting clears the server-side push token for signed-in users and suppresses
// banners/sounds locally for everyone.
export default function NotificationsScreen() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const auth = useAuth();
  const { entries, muted, unread } = useNotificationInbox();
  const [muteBusy, setMuteBusy] = useState(false);
  const signedIn = Boolean(auth.token);

  async function toggleMuted(value: boolean) {
    setMuteBusy(true);
    try {
      await setNotificationsMuted(value, signedIn);
    } finally {
      setMuteBusy(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 32, paddingTop: 4 }}>
        <BrandHeader subtitle="Notifications" />

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.ink, fontSize: 15 * effectiveScale, fontWeight: '700' }} allowFontScaling={false}>
                Mute notifications
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 * effectiveScale, marginTop: 2 }} allowFontScaling={false}>
                Stop push notifications from reaching this device. Notifications you already received stay below.
              </Text>
            </View>
            <Switch
              value={muted}
              onValueChange={(v) => void toggleMuted(v)}
              disabled={muteBusy}
              trackColor={{ false: colors.border, true: colors.brand }}
              thumbColor="#fff"
              accessibilityLabel="Mute notifications"
            />
          </View>
          {muted ? (
            <Banner tone="info">
              Notifications are muted. Turn the switch off to start receiving them again.
            </Banner>
          ) : null}
        </Card>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <SectionTitle
            title="Received"
            subtitle={entries.length === 0 ? 'Nothing yet' : `${entries.length} notification${entries.length === 1 ? '' : 's'}`}
          />
          {entries.length > 0 ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {unread > 0 ? (
                <AppButton variant="secondary" onPress={markAllInboxRead}>
                  Mark read
                </AppButton>
              ) : null}
              <AppButton variant="secondary" onPress={clearInbox}>
                Clear all
              </AppButton>
            </View>
          ) : null}
        </View>

        {entries.length === 0 ? (
          <Card>
            <Text style={{ color: colors.muted, fontSize: 14 * effectiveScale, textAlign: 'center' }} allowFontScaling={false}>
              No notifications yet. Announcements and updates will show up here.
            </Text>
          </Card>
        ) : (
          entries.map((entry) => (
            <Pressable
              key={entry.id}
              onPress={() => markInboxRead(entry.id)}
              accessibilityRole="button"
              accessibilityLabel={`Notification: ${entry.title}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text
                        style={{ color: colors.ink, fontSize: 15 * effectiveScale, fontWeight: entry.read ? '600' : '800', flexShrink: 1 }}
                        allowFontScaling={false}
                      >
                        {entry.title}
                      </Text>
                      {!entry.read ? <Pill tone="success">New</Pill> : null}
                    </View>
                    {entry.body ? (
                      <Text style={{ color: colors.muted, fontSize: 13 * effectiveScale, lineHeight: 19 * effectiveScale }} allowFontScaling={false}>
                        {entry.body}
                      </Text>
                    ) : null}
                    <Text style={{ color: colors.subtle, fontSize: 11 * effectiveScale, marginTop: 2 }} allowFontScaling={false}>
                      {formatReceivedAt(entry.receivedAt)}
                    </Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          ))
        )}

        <Text style={{ color: colors.subtle, fontSize: 11 * effectiveScale, textAlign: 'center' }} allowFontScaling={false}>
          Notifications are sent by the Light Rail Deals team only.
        </Text>
      </ScrollView>
    </Screen>
  );
}
