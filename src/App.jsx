import { useState } from 'react';
import EarthGlobe from './components/EarthGlobe';

function App() {
  const [visitedCountryIds, setVisitedCountryIds] = useState(() => new Set());

  const handleCountryToggle = (country) => {
    const countryId =
      country?.properties?.ISO_A3 ||
      country?.properties?.ADM0_A3 ||
      country?.id;

    if (!countryId || countryId === '-99') {
      return;
    }

    setVisitedCountryIds((current) => {
      const next = new Set(current);

      if (next.has(countryId)) {
        next.delete(countryId);
      } else {
        next.add(countryId);
      }

      return next;
    });
  };

  return (
    <main className="app-shell">
      <EarthGlobe
        visitedCountryIds={visitedCountryIds}
        onCountryClick={handleCountryToggle}
      />
    </main>
  );
}

export default App;
