# Member interface — Quiet Botanical

Design direction: a calm, premium biotech member service, not a trading terminal.
Warm ivory surfaces, forest-green membership card, restrained champagne accents,
fine borders and generous spacing. UCell text is a temporary typographic wordmark,
not a reconstruction of the unavailable official logo files.

- Mobile: qualification context, personal membership card, repurchase status,
  three performance metrics, settlement summary, six service shortcuts and catalog
  entry. Five icon-and-label destinations stay within the bottom safe area.
- Desktop (760px+): membership and financial overview are paired; service actions
  form one row in a bounded 1040px layout.
- Local SVG line icons and system font fallbacks; no remote font/image requests,
  invented product packaging, health claims, rank or earned-benefit promises.
- Every shortcut is an existing route. Qualification scope, null/pending amounts,
  mock-data disclosure and all existing API/session behavior remain unchanged.
- Existing focus rings, native select, labeled navigation and 44px controls are
  retained. Hover transitions respect reduced-motion preferences.

Implementation: `src/premium.css` is the visual layer over existing functional
styles; `src/Icon.tsx` contains decorative icons. Browser smoke now checks home
overflow at 320/390/768/1440px and records mobile and desktop screenshots.
Real LINE in-app device UAT and approved logo/product photography remain pending.
