import { useCallback, useRef, useState } from 'react';
import { FlatList, Image, Linking, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppButton, Banner, BrandHeader, Card, Pill, Screen, SectionTitle } from '@/components/Ui';
import { LinkifiedText } from '@/components/LinkifiedText';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { listRealEstate } from '@/lib/api';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';
import type { RealEstateRecord } from '@/lib/types';

function formatPrice(price: number | null, status: string): string {
  if (price == null) return status === 'for_lease' ? 'Lease — contact for pricing' : 'Contact for pricing';
  const formatted = `$${price.toLocaleString()}`;
  return status === 'for_lease' ? `${formatted}/mo` : formatted;
}

function statusLabel(status: string): string {
  switch (status) {
    case 'for_lease':
      return 'For Lease';
    case 'pending':
      return 'Pending';
    case 'sold':
      return 'Sold';
    default:
      return 'For Sale';
  }
}

function specs(listing: RealEstateRecord): string {
  const parts: string[] = [];
  if (listing.beds != null) parts.push(`${listing.beds} bd`);
  if (listing.baths != null) parts.push(`${listing.baths} ba`);
  if (listing.sqft != null) parts.push(`${listing.sqft.toLocaleString()} sqft`);
  return parts.join(' · ');
}

function addressLine(listing: RealEstateRecord): string {
  return [listing.address, [listing.city, listing.state].filter(Boolean).join(', '), listing.zip]
    .filter((part) => part && part.length > 0)
    .join(', ');
}

function ListingCard({ listing, imageHeight }: { listing: RealEstateRecord; imageHeight: number }) {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const specsText = specs(listing);
  const address = addressLine(listing);

  return (
    <Card>
      {listing.imageUrl ? (
        <Image
          source={{ uri: listing.imageUrl }}
          style={{ width: '100%', height: imageHeight, borderRadius: 16, backgroundColor: colors.panel }}
          resizeMode="cover"
          accessibilityLabel={listing.title}
        />
      ) : null}
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <Text style={{ color: colors.ink, fontSize: 19 * effectiveScale, fontWeight: '800', flexShrink: 1 }} allowFontScaling={false}>
            {listing.title}
          </Text>
          <Pill tone="neutral">{statusLabel(listing.listingStatus)}</Pill>
        </View>
        <Text style={{ color: colors.brand, fontSize: 17 * effectiveScale, fontWeight: '800' }} allowFontScaling={false}>
          {formatPrice(listing.price, listing.listingStatus)}
        </Text>
        {specsText ? (
          <Text style={{ color: colors.ink, fontSize: 14 * effectiveScale }} allowFontScaling={false}>
            {specsText}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {listing.propertyType ? <Pill tone="neutral">{listing.propertyType}</Pill> : null}
          {listing.station ? <Pill tone="warning">⚡ {listing.station}</Pill> : null}
        </View>
        {address ? (
          <Text style={{ color: colors.muted, fontSize: 13 * effectiveScale }} allowFontScaling={false}>
            {address}
          </Text>
        ) : null}
        {listing.description ? (
          <LinkifiedText
            text={listing.description}
            style={{ color: colors.muted, lineHeight: 20 * effectiveScale, fontSize: 14 * effectiveScale }}
            allowFontScaling={false}
          />
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {listing.phone ? (
            <AppButton variant="secondary" onPress={() => void Linking.openURL(`tel:${listing.phone}`)}>
              Call
            </AppButton>
          ) : null}
          {listing.email ? (
            <AppButton variant="secondary" onPress={() => void Linking.openURL(`mailto:${listing.email}`)}>
              Email
            </AppButton>
          ) : null}
          {listing.website ? (
            <AppButton
              variant="secondary"
              onPress={() => {
                const url = listing.website as string;
                void Linking.openURL(url.includes('://') ? url : `https://${url}`);
              }}
            >
              View listing
            </AppButton>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

export default function RealEstateScreen() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const { width } = useWindowDimensions();
  const imageHeight = Math.min(240, Math.max(150, width * 0.45));
  const listRef = useRef<FlatList<RealEstateRecord>>(null);
  const [listings, setListings] = useState<RealEstateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      void listRealEstate()
        .then((data) => {
          if (active) {
            setListings(data);
            setError(null);
          }
        })
        .catch((err) => {
          if (active) setError(err instanceof Error ? err.message : 'Unable to load listings');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <Screen>
      <FlatList
        ref={listRef}
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ListingCard listing={item} imageHeight={imageHeight} />}
        contentContainerStyle={{ gap: 18, paddingBottom: 32, paddingTop: 4 }}
        onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 400)}
        scrollEventThrottle={80}
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            <BrandHeader subtitle="Real Estate" />
            <SectionTitle title="Homes & property near the rail" subtitle="Listings along the Valley Metro corridor" />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <Banner tone="info">Loading listings…</Banner>
          ) : error ? (
            <Banner tone="error">{error}</Banner>
          ) : (
            <Card>
              <View style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
                <Text style={{ fontSize: 44 * effectiveScale }} allowFontScaling={false}>
                  🏘
                </Text>
                <Text style={{ color: colors.ink, fontSize: 20 * effectiveScale, fontWeight: '800', textAlign: 'center' }} allowFontScaling={false}>
                  Coming soon
                </Text>
                <Text
                  style={{ color: colors.muted, fontSize: 14 * effectiveScale, lineHeight: 22 * effectiveScale, textAlign: 'center', maxWidth: 320 }}
                  allowFontScaling={false}
                >
                  Real estate listings along the light rail are on the way. Check back soon.
                </Text>
              </View>
            </Card>
          )
        }
      />
      <ScrollToTopButton visible={showScrollTop} onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} />
    </Screen>
  );
}
