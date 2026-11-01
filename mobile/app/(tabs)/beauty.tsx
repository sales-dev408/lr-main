import { BusinessDirectory } from '@/components/BusinessDirectory';

// Health & Beauty — salons, barbers, pharmacies, spas, urgent care, fitness,
// and wellness businesses along the light rail.
export default function BeautyScreen() {
  return (
    <BusinessDirectory
      title="Health & Beauty"
      subtitle="Beauty, health, and wellness along the light rail"
      adSlot={5}
      config={{
        vendorTypes: ['beauty'],
        typeOptions: [],
        layout: 'directory',
        categoryDropdown: 'Health & Beauty Filter',
      }}
    />
  );
}
