export type AdminRole = 'owner' | 'admin' | 'analyst';
export type CardTheme = 'sports' | 'entertainment' | 'shops_restaurants';
export type VendorStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type CardStatus = 'draft' | 'active' | 'archived';
export type DiscountType = 'fixed' | 'percent' | 'bogo';
export type PosType = 'square' | 'stripe' | 'clover' | 'toast' | 'other';
export type UserStatus = 'active' | 'suspended' | 'deleted';

export interface AdminProfile {
  id: string;
  email: string;
  role: AdminRole;
}

export interface AdminSettings {
  id: string;
  email: string;
  role: AdminRole;
  location: string | null;
}

export type VendorCategory = 'Sports' | 'Dining' | 'Entertainment';

export interface CreateVendorResult {
  vendor: { id: string; name: string; ownerName: string | null; address: string | null; category: string; email: string | null; phone: string | null; latitude: number | null; longitude: number | null };
  discountCode: string;
  discount: { id: string; type: DiscountType; value: number; label: string };
  membershipCard: { id: string; name: string };
  posInstructions: string;
}

export interface VendorPassResult {
  discountCode: string | null;
  discount: { type: DiscountType; value: number; label: string };
  membershipCard: { id: string; name: string };
  posInstructions: string;
}

export interface AuthResponse<TProfile> {
  token: string;
  expiresIn?: string;
  profile: TProfile;
}

export interface AdminAnalyticsResponse {
  totals: {
    redemptions: number;
    uniqueCustomers: number;
  };
  usageByVendor: Array<{
    vendorId: string;
    vendorName: string;
    redemptions: number;
  }>;
  usageByCard: Array<{
    cardId: string;
    cardName: string;
    redemptions: number;
  }>;
  timeSeries: Array<{
    day: string;
    redemptions: number;
  }>;
  topPerformers: Array<{
    vendorId: string;
    vendorName: string;
    redemptions: number;
  }>;
}

export interface VendorRecord {
  id: string;
  name: string;
  owner_name: string | null;
  location: string | null;
  address: string | null;
  city: string | null;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
  pos_type: PosType | null;
  pos_system: string | null;
  icon_url: string | null;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  discount_code?: string | null;
  discount_type?: 'fixed' | 'percent' | 'bogo' | null;
  discount_value?: number | string | null;
  discount_description?: string | null;
  discount_terms?: string | null;
  discount_starts_at?: string | null;
  discount_ends_at?: string | null;
  boosted?: boolean | null;
  status: VendorStatus;
  created_at?: string;
  updated_at?: string;
}

export interface VendorActivityRecord {
  id: string;
  actor_type: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  created_at: string;
}

export type CardLayout = 'qr_top' | 'qr_bottom' | 'qr_left' | 'qr_right';

export interface CardSummary {
  id: string;
  name: string;
  is_membership: boolean;
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
  status: CardStatus;
  participatingBusinesses?: CardVendorSummary[];
}

export interface CardVendorSummary {
  id: string;
  name: string;
  city: string | null;
  discount: DiscountSummary | null;
}

export interface DiscountSummary {
  id: string;
  cardId: string;
  vendorId: string;
  type: DiscountType;
  value: number;
  min_purchase: number;
  max_uses_total: number | null;
  max_uses_per_customer: number | null;
  uses_count: number;
  city_overrides: Record<string, { type?: DiscountType; value?: number }>;
  active: boolean;
  applied?: {
    type: DiscountType;
    value: number;
    description: string;
    instruction?: string;
  };
}

export interface CardDetailResponse extends CardSummary {
  participatingBusinesses: Array<{
    id: string;
    name: string;
    city: string | null;
    discount: DiscountSummary | null;
  }>;
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

export interface AdminEvent {
  id: string;
  title: string;
  description: string | null;
  eventDate: string | null;
  imageUrl: string | null;
  createdAt: string;
}

export interface AdRecord {
  id: string;
  slot: number;
  image_url: string;
  link_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PushPreferences {
  newVendor: boolean;
  expiringDeal: boolean;
  localEvent: boolean;
}

export interface UserRecord {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  city: string | null;
  status: UserStatus;
  pushPreferences: PushPreferences;
  promoEmailOptIn: boolean;
  promoSmsOptIn: boolean;
  termsAcceptedAt: string | null;
  privacyAcceptedAt: string | null;
  eulaAcceptedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
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
  near_rail: boolean;
  distance_miles: number | null;
  created_at: string;
  updated_at: string;
}

export interface ContentStatus {
  currentVersion: number;
  publishedAt: string | null;
  publishedCount: number;
  draftCount: number;
  publishedCounts: { vendors: number; apartments: number; events: number; content: number };
  draftCounts: { vendors: number; apartments: number; events: number; content: number };
}

export interface PublicCardsResponseItem {
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
  status: CardStatus;
  participatingBusinesses: Array<{
    id: string;
    name: string;
    city: string | null;
    discount: DiscountSummary | null;
  }>;
}
