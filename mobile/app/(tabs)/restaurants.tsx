import { BusinessDirectory } from '@/components/BusinessDirectory';

// Restaurants & Bars — the dining slice of the old Browse tab. Keeps the
// cuisine selector and accepts the legacy ?type= deep links from Browse.
export default function RestaurantsScreen() {
  return (
    <BusinessDirectory
      title="Restaurants & Bars"
      subtitle="Dining and nightlife along the light rail"
      adSlot={2}
      config={{
        vendorTypes: ['restaurant', 'bar', 'cafe'],
        cuisineFilter: true,
        typeOptions: [
          { label: 'All', types: null, aliases: ['Bars & Restaurants'] },
          { label: 'Restaurant', types: ['restaurant'] },
          { label: 'Bar', types: ['bar'] },
          { label: 'Cafe', types: ['cafe'] },
        ],
      }}
    />
  );
}
