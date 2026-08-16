export type CardTheme = 'sports' | 'entertainment' | 'shops_restaurants';
export type WalletPlatform = 'apple' | 'google';
export type DiscountType = 'fixed' | 'percent' | 'bogo';
export type CityOverrideMap = Record<string, { type?: DiscountType; value?: number }>;

export interface PushPreferences {
  newVendor: boolean;
  expiringDeal: boolean;
  localEvent: boolean;
}

export interface UserProfile {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  city: string | null;
  status: 'active' | 'suspended' | 'deleted';
  pushPreferences: PushPreferences;
  promoEmailOptIn: boolean;
  promoSmsOptIn: boolean;
  termsAcceptedAt: string | null;
  privacyAcceptedAt: string | null;
  eulaAcceptedAt: string | null;
}

export interface AdminAuthProfile {
  id: string;
  email: string;
  role: string;
}

export type ContentKind = 'text' | 'article' | 'image' | 'file' | 'embed';

export interface ContentBlock {
  id: string;
  kind: ContentKind;
  title: string;
  body: string | null;
  url: string | null;
  position: number;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface ThemeTab {
  key: string;
  label: string;
  color: string;
  gradient: [string, string];
}

export interface ThemeSettings {
  brand: string;
  primaryGradient: [string, string];
  tabs: ThemeTab[];
}

export interface AuthResponse<TProfile> {
  token: string;
  expiresIn?: string;
  profile: TProfile;
  membershipPass?: MembershipPass | null;
  walletUrl?: string | null;
}

// The user's single all-in-one membership pass. Auto-generated at signup; its
// barcode (lookupToken) is scanned at any participating business.
export interface MembershipPass {
  passId: string;
  serialNumber: string;
  lookupToken: string;
  barcodeValue: string;
  cardId: string;
  walletUrl: string | null;
  androidUrl: string | null;
  passUrl: string | null;
}

export interface OnboardingResponse {
  theme: CardTheme;
  card: string;
  vendor: string;
  appStoreUrl: string;
  playStoreUrl: string;
}

export interface CardDiscount {
  id: string;
  cardId: string;
  vendorId: string;
  type: DiscountType;
  value: number;
  min_purchase: number;
  max_uses_total: number | null;
  max_uses_per_customer: number | null;
  uses_count: number;
  city_overrides: CityOverrideMap;
  active: boolean;
  applied?: {
    type: DiscountType;
    value: number;
    description: string;
    instruction?: string;
  };
}

export interface ParticipatingBusiness {
  id: string;
  name: string;
  city: string | null;
  discount: CardDiscount | null;
}

export type CardLayout = 'qr_top' | 'qr_bottom' | 'qr_left' | 'qr_right';

export interface CardSummary {
  id: string;
  name: string;
  theme: CardTheme;
  description: string | null;
  image_url: string | null;
  logo_url: string | null;
  icon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  qr_size: number | null;
  layout: CardLayout | null;
  expiration_date: string | null;
  max_uses: number | null;
  status: string;
  participatingBusinesses: ParticipatingBusiness[];
}

export type CardDetail = CardSummary;

export interface VendorListItem {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
  posSystem: string | null;
  iconUrl: string | null;
  logoUrl: string | null;
  discount: { type: DiscountType; value: number; label: string; description?: string | null };
  discountCode: string | null;
  discountTerms: string;
  discountDescription: string | null;
  boosted: boolean;
  startsAt: string | null;
  endsAt: string | null;
  cardId: string;
  walletUrl: string | null;
}

export interface WalletPassMetadata {
  passId: string;
  serialNumber: string;
  lookupToken: string;
  authToken: string;
  cardName: string;
  description: string | null;
}

export interface AppleWalletPayload {
  status: number;
  message: string;
  passJson: Record<string, unknown>;
  certificateLoaded?: boolean;
}

export interface GoogleWalletPayload {
  configured: boolean;
  message?: string;
  jwt?: string;
  saveUrl?: string;
}

export interface CreatePassResponse {
  pass: { passId: string; serialNumber: string; lookupToken: string; barcodeValue: string; cardId: string };
  walletUrl: string | null;
  androidUrl: string | null;
  passUrl: string | null;
  downloadUrl: string;
}

export interface StoredPass extends WalletPassMetadata {
  platform: WalletPlatform;
  addedAt: string;
  walletMessage?: string;
  walletUrl?: string;
}

export interface PassDetail {
  id: string;
  user_id: string;
  card_id: string;
  platform: WalletPlatform;
  serial_number: string;
  auth_token: string;
  lookup_token: string;
  device_library_id: string | null;
  push_token: string | null;
  created_at: string;
  updated_at: string;
  card_name?: string;
  card_description?: string | null;
}

export interface LookupResult {
  pass?: {
    pass_id: string;
    user_id: string;
    card_id: string;
    user_email: string | null;
    user_phone: string | null;
    user_full_name: string;
    card_name: string;
    card_theme: CardTheme;
    card_description: string | null;
    card_image_url: string | null;
    vendor_id: string | null;
    vendor_name: string | null;
  };
  card?: {
    id: string;
    name: string;
    theme: CardTheme;
    description: string | null;
    image_url: string | null;
    expiration_date: string | null;
    max_uses: number | null;
    status: string;
  };
  discounts: {
    id: string;
    type: DiscountType;
    value: number;
    description: string;
    instruction?: string;
    cardId?: string;
    vendorId?: string;
    discountCode?: string | null;
  }[];
}

export interface RedeemResult {
  valid: boolean;
  reason?: string;
  discount?: {
    type: DiscountType;
    value: number;
    description: string;
  };
  amountApplied?: number;
  instruction?: string;
  redemptionId?: string;
}

export interface UserAnalytics {
  totalRedemptions: number;
  byVendor: { vendorId: string; vendorName: string; redemptions: number }[];
  daily: { day: string; redemptions: number }[];
}

export interface DiscountLookup {
  vendorName: string;
  cardName: string;
  discountCode: string;
  type: DiscountType;
  value: number;
  discountLabel: string;
}

export interface RssEvent {
  id: string;
  title: string;
  description: string | null;
  link: string | null;
  pubDate: string | null;
  sourceName: string | null;
  imageUrl: string | null;
}

export interface Ad {
  id: string;
  slot: number;
  image_url: string;
  link_url: string | null;
  active: boolean;
}

export interface ErrorShape {
  error?: string | { code?: string; message?: string };
}

export interface ApartmentRecord {
  id: string;
  name: string;
  section: string | null;
  station: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
}
