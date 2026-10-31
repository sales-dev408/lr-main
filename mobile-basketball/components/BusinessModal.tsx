import { Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton, Pill, SectionTitle } from '@/components/Ui';
import { useAuth } from '@/lib/auth';
import { useAppColorScheme } from '@/lib/colorScheme';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';
import { useFavorites } from '@/lib/favorites';
import { shareDeal } from '@/lib/share';
import { findStop } from '@/lib/stops';
import type { VendorListItem } from '@/lib/types';

function formatTimeRemaining(endsAt: string | null): string | null {
  if (!endsAt) return null;
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h left`;
  }
  return `${hours}h ${minutes}m left`;
}

function normalizeWebsite(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

type Props = {
  vendor: VendorListItem | null;
  onClose: () => void;
};

// Closeable business detail modal — replaces the old bottom-of-list info card.
// Every phone number renders as a tel: link and every website as an href.
export function BusinessModal({ vendor, onClose }: Props) {
  const colors = useThemeColors();
  const { scheme } = useAppColorScheme();
  const { effectiveScale } = useDynamicType();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const auth = useAuth();
  const { toggle: toggleFavorite, isFavorite } = useFavorites();

  if (!vendor) return null;

  const signedIn = Boolean(auth.token);
  const favorite = isFavorite(vendor.id);
  const locked = vendor.membersOnly && !signedIn;
  const remaining = formatTimeRemaining(vendor.endsAt);
  const line = findStop(vendor.station)?.line ?? null;

  function openMaps() {
    if (!vendor?.address) return;
    void Linking.openURL(
      Platform.select({
        ios: `maps:?q=${encodeURIComponent(vendor.address)}`,
        android: `geo:0,0?q=${encodeURIComponent(vendor.address)}`,
        default: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vendor.address)}`,
      }) ?? '',
    );
  }

  function openDiscount() {
    onClose();
    router.push((`/discount?vendorId=${encodeURIComponent(vendor!.id)}`) as never);
  }

  function openAuth() {
    onClose();
    router.push('/auth' as never);
  }

  function onFavorite() {
    if (!signedIn) {
      openAuth();
      return;
    }
    void toggleFavorite(vendor!.id);
  }

  const backdrop =
    isLiquidGlassSupported || Platform.OS === 'ios' ? (
      <BlurView intensity={25} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
    ) : (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12, 10, 9, 0.5)' }]} />
    );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        {backdrop}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close business details" />
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.panel,
              borderColor: colors.border,
              marginTop: insets.top + 48,
              marginBottom: insets.bottom + 24,
              maxWidth: Math.min(480, width - 32),
            },
          ]}
        >
          {isLiquidGlassSupported ? (
            <LiquidGlassView effect="regular" colorScheme={scheme} style={StyleSheet.absoluteFill} />
          ) : null}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={[styles.close, { backgroundColor: colors.brandSoft }]}
          >
            <Text style={{ color: colors.ink, fontSize: 15 * effectiveScale, fontWeight: '800' }} allowFontScaling={false}>✕</Text>
          </Pressable>
          <ScrollView contentContainerStyle={{ gap: 12, padding: 20, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
            {vendor.logoUrl || vendor.iconUrl ? (
              <Image
                source={{ uri: vendor.logoUrl ?? vendor.iconUrl ?? undefined }}
                style={{ width: '100%', height: Math.min(140, Math.max(96, width * 0.24)), borderRadius: 16, backgroundColor: colors.brandSoft }}
                resizeMode="contain"
              />
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <SectionTitle title={vendor.name} subtitle={vendor.category ?? vendor.vendorType ?? undefined} />
              </View>
              <Pressable
                onPress={onFavorite}
                accessibilityLabel={
                  !signedIn ? 'Sign in to save favorites' : favorite ? 'Remove from favorites' : 'Add to favorites'
                }
                style={{ padding: 6 }}
              >
                <Text style={{ fontSize: 26 * effectiveScale, color: favorite ? colors.accent : colors.subtle }} allowFontScaling={false}>
                  {favorite ? '♥' : '♡'}
                </Text>
              </Pressable>
            </View>
            {vendor.station ? (
              <Text style={{ color: colors.muted, fontSize: 14 * effectiveScale }} allowFontScaling={false}>
                📍 {vendor.station}
                {line ? ` · ${line}` : ''}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Pill tone={locked ? 'neutral' : 'success'}>{locked ? '🔒 Members-only deal' : vendor.discount.label}</Pill>
              {vendor.boosted ? <Pill tone="warning">Flash deal</Pill> : null}
              {remaining ? <Pill tone="neutral">{remaining}</Pill> : null}
            </View>
            {vendor.address ? (
              <Text style={{ color: colors.muted, fontSize: 14 * effectiveScale, lineHeight: 20 * effectiveScale }} allowFontScaling={false}>
                {vendor.address}
                {vendor.city ? `, ${vendor.city}` : ''}
              </Text>
            ) : null}
            {vendor.phone ? (
              <Text
                accessibilityRole="link"
                onPress={() => void Linking.openURL(`tel:${vendor.phone!.replace(/[^\d+]/g, '')}`)}
                style={{ color: colors.brand, fontSize: 14 * effectiveScale, textDecorationLine: 'underline' }}
                allowFontScaling={false}
              >
                {vendor.phone}
              </Text>
            ) : null}
            {vendor.website ? (
              <Text
                accessibilityRole="link"
                onPress={() => void Linking.openURL(normalizeWebsite(vendor.website!))}
                style={{ color: colors.brand, fontSize: 14 * effectiveScale, textDecorationLine: 'underline' }}
                allowFontScaling={false}
                numberOfLines={1}
              >
                {vendor.website}
              </Text>
            ) : null}
            {vendor.discountDescription ? (
              <Text style={{ color: colors.ink, fontSize: 14 * effectiveScale, lineHeight: 20 * effectiveScale }} allowFontScaling={false}>
                {vendor.discountDescription}
              </Text>
            ) : null}
            <Text style={{ color: colors.muted, fontSize: 10 * effectiveScale, lineHeight: 14 * effectiveScale }} allowFontScaling={false}>
              {vendor.discountTerms}
            </Text>

            <View style={{ gap: 10, marginTop: 4 }}>
              {locked ? (
                <AppButton onPress={openAuth}>Sign in to redeem this deal</AppButton>
              ) : (
                <AppButton onPress={openDiscount}>Show discount QR</AppButton>
              )}
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {vendor.address ? (
                  <AppButton variant="secondary" onPress={openMaps} style={{ flexGrow: 1 }}>
                    Directions
                  </AppButton>
                ) : null}
                {vendor.phone ? (
                  <AppButton
                    variant="secondary"
                    onPress={() => void Linking.openURL(`tel:${vendor.phone!.replace(/[^\d+]/g, '')}`)}
                    style={{ flexGrow: 1 }}
                  >
                    Call
                  </AppButton>
                ) : null}
                {vendor.website ? (
                  <AppButton variant="secondary" onPress={() => void Linking.openURL(normalizeWebsite(vendor.website!))} style={{ flexGrow: 1 }}>
                    Website
                  </AppButton>
                ) : null}
              </View>
              <AppButton variant="secondary" onPress={() => void shareDeal(vendor)}>
                Share this deal
              </AppButton>
              {!signedIn ? (
                <Text style={{ color: colors.muted, fontSize: 12 * effectiveScale, textAlign: 'center' }} allowFontScaling={false}>
                  Sign in to save favorites and unlock member-exclusive deals.
                </Text>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxHeight: '100%',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  close: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
