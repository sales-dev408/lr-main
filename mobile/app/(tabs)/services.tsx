import { BusinessDirectory } from '@/components/BusinessDirectory';

// Services — banks, auto, legal, health, and other local services along the
// light rail, grouped by city. Filter pills mirror the downtown service
// directory category headers.
export default function ServicesScreen() {
  return (
    <BusinessDirectory
      title="Services"
      subtitle="Local services along the light rail"
      adSlot={5}
      config={{
        vendorTypes: ['services'],
        groupByCity: true,
        cityOrder: ['Phoenix', 'Tempe', 'Mesa'],
        typeOptions: [
          { label: 'All Services', types: null },
          { label: 'Auto Services', types: ['services'], categories: ['Auto Services'] },
          { label: 'Banks', types: ['services'], categories: ['Banks'] },
          { label: 'Beauty/Barber/Tattoo', types: ['services'], categories: ['Beauty/Barber/Tattoo', 'Beauty', 'Barber', 'Tattoo'] },
          { label: 'Contracted Services', types: ['services'], categories: ['Contracted Services'] },
          { label: 'Entertainment', types: ['services'], categories: ['Entertainment'] },
          { label: 'Finance & Legal', types: ['services'], categories: ['Finance & Legal', 'Finance', 'Legal'] },
          { label: 'Health & Wellness', types: ['services'], categories: ['Health & Wellness', 'Health', 'Wellness'] },
          { label: 'Housing/Hotels', types: ['services'], categories: ['Housing/Hotels', 'Housing', 'Hotel'] },
          { label: 'Industrial', types: ['services'], categories: ['Industrial'] },
          { label: 'Insurance', types: ['services'], categories: ['Insurance'] },
          { label: 'Non-Profit', types: ['services'], categories: ['Non-Profit', 'Nonprofit'] },
          { label: 'Offices', types: ['services'], categories: ['Offices', 'Office'] },
          { label: 'Photography', types: ['services'], categories: ['Photography'] },
          { label: 'Religious Centers', types: ['services'], categories: ['Religious Centers', 'Religious', 'Church'] },
          { label: 'Venue', types: ['services'], categories: ['Venue'] },
        ],
      }}
    />
  );
}
