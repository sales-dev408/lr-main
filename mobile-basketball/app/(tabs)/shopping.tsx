import { BusinessDirectory } from '@/components/BusinessDirectory';

// Shopping — boutiques, beauty, and other retail along the light rail. More
// category filters are planned; the type pills keep parity with the old
// Browse options for now.
export default function ShoppingScreen() {
  return (
    <BusinessDirectory
      title="Shopping"
      subtitle="Shops and services along the light rail"
      adSlot={4}
      config={{
        vendorTypes: ['boutique', 'beauty', 'other'],
        typeOptions: [
          { label: 'All', types: null },
          { label: 'Boutique Shops', types: ['boutique'], aliases: ['Boutique'] },
          { label: 'Beauty', types: ['beauty'] },
          { label: 'More Shops', types: ['other'], aliases: ['Other'] },
        ],
      }}
    />
  );
}
