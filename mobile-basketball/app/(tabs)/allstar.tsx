import { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AppButton, Card, Pill, Screen, SectionTitle } from '@/components/Ui';
import {
  ALLSTAR_CITY,
  ALLSTAR_DATES,
  ALLSTAR_LINKS,
  ALLSTAR_SCHEDULE,
  DAILY_DROPS,
  GAME_DAYS,
  PHX_HISTORY,
  TICKET_PACKAGES,
  daysUntilTipOff,
  type AllStarEvent,
} from '@/lib/allstar';
import {
  formatMinutes,
  lastTrainAt,
  nextDepartures,
  titleCaseStation,
} from '@/lib/allstarTrip';
import { cancelEventReminder, remindersSupported, scheduleEventReminder } from '@/lib/allstarReminders';
import { fonts } from '@/lib/theme';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';

const DAY_KEY: Record<string, string> = { Friday: 'fri', Saturday: 'sat', Sunday: 'sun' };

function ExtLink({ label, url }: { label: string; url: string }) {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  return (
    <Pressable
      onPress={() => void Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint="Opens in your browser"
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          paddingVertical: 11,
          paddingHorizontal: 14,
          backgroundColor: colors.panel,
        },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text style={{ flex: 1, color: colors.ink, fontWeight: '700', fontSize: 14 * effectiveScale }} allowFontScaling={false}>
        {label}
      </Text>
      <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 14 * effectiveScale }} allowFontScaling={false}>
        {'↗'}
      </Text>
    </Pressable>
  );
}

// Morning-of local notification for an event — native only, degrades silently.
function ReminderBell({ event }: { event: AllStarEvent }) {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const [set, setReminder] = useState(false);
  if (!remindersSupported()) return null;

  async function toggle() {
    const dayKey = DAY_KEY[event.day] ?? 'fri';
    const day = GAME_DAYS.find((d) => d.key === dayKey) ?? GAME_DAYS[0];
    if (set) {
      await cancelEventReminder(`${dayKey}-${event.title}`);
      setReminder(false);
      return;
    }
    const ok = await scheduleEventReminder(`${dayKey}-${event.title}`, event.title, day.date);
    if (ok) setReminder(true);
  }

  return (
    <Pressable
      onPress={() => void toggle()}
      accessibilityRole="button"
      accessibilityLabel={set ? `Cancel reminder for ${event.title}` : `Remind me on ${event.day} morning`}
      accessibilityState={{ selected: set }}
      hitSlop={8}
      style={{ padding: 4 }}
    >
      <Text style={{ fontSize: 16 * effectiveScale, opacity: set ? 1 : 0.5, color: colors.accent }} allowFontScaling={false}>
        {set ? '🔔' : '🔕'}
      </Text>
    </Pressable>
  );
}

// Live departures from the two arena stations right now, plus tonight's last
// trains — all computed from the published Valley Metro timetable.
function PlatformPulse() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const now = new Date();

  const platforms = [
    { station: '3RD ST/JEFFERSON', line: 'a' as const, direction: 'eastbound' as const, note: 'eastbound — toward Tempe & Mesa' },
    { station: '3RD ST/WASHINGTON', line: 'a' as const, direction: 'westbound' as const, note: 'westbound — toward the Hub' },
    { station: 'DOWNTOWN PHX HUB/1ST AVE', line: 'b' as const, direction: 'southbound' as const, note: 'southbound — toward Baseline' },
    { station: 'WASHINGTON/CENTRAL AVE', line: 'b' as const, direction: 'northbound' as const, note: 'northbound — toward Metrocenter' },
  ];

  return (
    <Card>
      <SectionTitle title="Platform pulse" subtitle="Live departures from the arena stops, right now" />
      {platforms.map((p) => {
        const next = nextDepartures(p.line, p.direction, p.station, now, 2);
        return (
          <View key={`${p.station}-${p.direction}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 14 * effectiveScale }} allowFontScaling={false}>
                {titleCaseStation(p.station)}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 * effectiveScale }} allowFontScaling={false}>
                {p.note}
              </Text>
            </View>
            <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 14 * effectiveScale }} allowFontScaling={false}>
              {next.length ? next.map(formatMinutes).join('  •  ') : 'Service ended'}
            </Text>
          </View>
        );
      })}
      <Text style={{ color: colors.subtle, fontSize: 12 * effectiveScale }} allowFontScaling={false}>
        Expect heavy platforms 30–60 min after events — the 1st Ave B Line platform is usually the lighter walk.
      </Text>
    </Card>
  );
}

// "Don't get stranded" strip — last departures from the arena stops for each
// of the three event days.
function LastTrainCard() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const rows = GAME_DAYS.map((d) => ({
    label: d.label,
    aEast: lastTrainAt('a', 'eastbound', '3RD ST/JEFFERSON', d.dayType),
    aWest: lastTrainAt('a', 'westbound', '3RD ST/WASHINGTON', d.dayType),
    bNorth: lastTrainAt('b', 'northbound', 'WASHINGTON/CENTRAL AVE', d.dayType),
    bSouth: lastTrainAt('b', 'southbound', 'DOWNTOWN PHX HUB/JEFFERSON ST', d.dayType),
  }));

  return (
    <Card>
      <SectionTitle title="Last train alerts" subtitle="Final departures from downtown each night" />
      {rows.map((r) => (
        <View key={r.label} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, gap: 4 }}>
          <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 14 * effectiveScale }} allowFontScaling={false}>
            {r.label}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13 * effectiveScale }} allowFontScaling={false}>
            A Line — east {r.aEast != null ? formatMinutes(r.aEast) : '—'} • west {r.aWest != null ? formatMinutes(r.aWest) : '—'}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13 * effectiveScale }} allowFontScaling={false}>
            B Line — north {r.bNorth != null ? formatMinutes(r.bNorth) : '—'} • south {r.bSouth != null ? formatMinutes(r.bSouth) : '—'}
          </Text>
        </View>
      ))}
      <Text style={{ color: colors.subtle, fontSize: 12 * effectiveScale }} allowFontScaling={false}>
        From the published timetable — Valley Metro often extends service for big events; check advisories that week.
      </Text>
    </Card>
  );
}

export default function AllStarScreen() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const days = daysUntilTipOff();
  const dropIndex = days % DAILY_DROPS.length;
  const drops = [0, 1, 2].map((i) => DAILY_DROPS[(dropIndex + i) % DAILY_DROPS.length]);

  return (
    <Screen accessibilityLabel="NBA All-Star 2027 guide">
      <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 32, paddingTop: 4 }}>
        <LinearGradient
          colors={['#1d1160', '#5b2a86', '#e56020']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 24, padding: 22, gap: 10 }}
        >
          <Text
            style={{
              color: '#f9a01b',
              fontSize: 12 * effectiveScale,
              fontWeight: '800',
              letterSpacing: 2,
            }}
            allowFontScaling={false}
          >
            {'🏀'} PHOENIX • FIRST TIME BACK SINCE 2009
          </Text>
          <Text
            style={{ color: '#fff', fontSize: 30 * effectiveScale, fontWeight: '800', fontFamily: fonts.display, letterSpacing: 0.5 }}
            allowFontScaling={false}
          >
            NBA ALL-STAR 2027
          </Text>
          <Text style={{ color: '#e9e5f8', fontSize: 15 * effectiveScale, fontWeight: '600' }} allowFontScaling={false}>
            {ALLSTAR_DATES} • {ALLSTAR_CITY}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <Text
              style={{ color: '#fff', fontSize: 42 * effectiveScale, fontWeight: '800', fontFamily: fonts.display }}
              allowFontScaling={false}
            >
              {days}
            </Text>
            <Text style={{ color: '#f9a01b', fontSize: 15 * effectiveScale, fontWeight: '700' }} allowFontScaling={false}>
              days to tip-off
            </Text>
          </View>
          <Pill accessibilityLabel="Works offline">Schedule, map & guide are bundled — works offline</Pill>
        </LinearGradient>

        <Card>
          <SectionTitle title={"Today's drop"} subtitle="Rotating tips as the countdown runs" />
          {drops.map((drop, i) => (
            <View key={drop.tag + i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Pill tone={i === 0 ? 'warning' : 'neutral'}>{i === 0 ? 'Today' : `+${i}`}</Pill>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.accent, fontSize: 11 * effectiveScale, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 }} allowFontScaling={false}>
                  {drop.tag}
                </Text>
                <Text style={{ color: colors.ink, fontSize: 14 * effectiveScale, lineHeight: 19 * effectiveScale }} allowFontScaling={false}>
                  {drop.text}
                </Text>
              </View>
            </View>
          ))}
        </Card>

        <Card>
          <SectionTitle title="Ride the rail to the game" subtitle="Skip the parking surge — the arena sits on the line" />
          <Text style={{ color: colors.muted, fontSize: 14 * effectiveScale, lineHeight: 20 * effectiveScale }} allowFontScaling={false}>
            Mortgage Matchup Center sits between the 3rd St / Jefferson and 3rd St / Washington stations on the
            A Line — about a two-minute walk. The Downtown Hub stations at Central Ave and 1st Ave are five minutes
            on foot.
          </Text>
          <Link href="/trip-planner" asChild>
            <AppButton>Plan my trip — real train times</AppButton>
          </Link>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Link href="/park-ride" asChild>
                <AppButton variant="secondary">Park & ride</AppButton>
              </Link>
            </View>
            <View style={{ flex: 1 }}>
              <Link href="/downtown-map" asChild>
                <AppButton variant="secondary">Venue map</AppButton>
              </Link>
            </View>
          </View>
        </Card>

        <PlatformPulse />
        <LastTrainCard />

        <Card>
          <SectionTitle title="Weekend lineup" subtitle="Feb 19–21 • tap the bell for a morning-of reminder" />
          {ALLSTAR_SCHEDULE.map((event) => (
            <View key={`${event.date}-${event.title}`} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <View style={{ width: 62, alignItems: 'center', backgroundColor: colors.brandSoft, borderRadius: 12, paddingVertical: 8 }}>
                <Text style={{ color: colors.brand, fontSize: 11 * effectiveScale, fontWeight: '800', textTransform: 'uppercase' }} allowFontScaling={false}>
                  {event.day.slice(0, 3)}
                </Text>
                <Text style={{ color: colors.ink, fontSize: 15 * effectiveScale, fontWeight: '800' }} allowFontScaling={false}>
                  {event.date.replace('Feb ', '2/')}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors.ink, fontSize: 15 * effectiveScale, fontWeight: '800' }} allowFontScaling={false}>
                  {event.title}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 13 * effectiveScale, lineHeight: 18 * effectiveScale }} allowFontScaling={false}>
                  {event.detail}
                </Text>
                <Text style={{ color: colors.accent, fontSize: 12 * effectiveScale, fontWeight: '700' }} allowFontScaling={false}>
                  {event.venue}
                </Text>
              </View>
              <ReminderBell event={event} />
            </View>
          ))}
          {Platform.OS === 'web' ? (
            <Text style={{ color: colors.subtle, fontSize: 12 * effectiveScale }} allowFontScaling={false}>
              Reminders need the mobile app — open this on your phone.
            </Text>
          ) : null}
          <Text style={{ color: colors.subtle, fontSize: 12 * effectiveScale }} allowFontScaling={false}>
            Schedule via nbaevents.nba.com — times subject to change.
          </Text>
        </Card>

        <Card>
          <SectionTitle title="Phoenix All-Star history" subtitle="The Valley's fourth rodeo" />
          {PHX_HISTORY.map((h) => (
            <View key={h.year} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Text
                style={{ color: colors.brand, fontSize: 17 * effectiveScale, fontWeight: '800', fontFamily: fonts.display, width: 48 }}
                allowFontScaling={false}
              >
                {h.year}
              </Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors.ink, fontSize: 14 * effectiveScale, fontWeight: '800' }} allowFontScaling={false}>
                  {h.title}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 13 * effectiveScale, lineHeight: 18 * effectiveScale }} allowFontScaling={false}>
                  {h.detail}
                </Text>
              </View>
            </View>
          ))}
        </Card>

        <Card>
          <SectionTitle title="Fan experiences" subtitle="Build your All-Star weekend" />
          <Pill>Fan Pass: Jam Session + Celebrity Game + Music Festival</Pill>
          <View style={{ gap: 10 }}>
            <ExtLink label="Build Your All-Star — personalized picks" url={ALLSTAR_LINKS.buildFanPass} />
            <ExtLink label="Browse curated options" url={ALLSTAR_LINKS.curated} />
            <ExtLink label="Official All-Star hub" url={ALLSTAR_LINKS.hub} />
          </View>
        </Card>

        <Card>
          <SectionTitle title="Official ticket packages" subtitle="NBA Experiences presented by DoorDash" />
          {TICKET_PACKAGES.map((pkg) => (
            <ExtLink key={pkg.name} label={`${pkg.name} — ${pkg.blurb}`} url={pkg.url} />
          ))}
          <ExtLink label="Compare all packages" url={ALLSTAR_LINKS.packages} />
        </Card>

        <Card>
          <SectionTitle title="Stay in the loop" subtitle="Presales, drops and announcements" />
          <View style={{ gap: 10 }}>
            <ExtLink label="Register for exclusive access" url={ALLSTAR_LINKS.hub} />
            <ExtLink label="Get the NBA App" url={ALLSTAR_LINKS.nbaApp} />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}
