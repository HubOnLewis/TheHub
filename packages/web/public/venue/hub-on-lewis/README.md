# HuB on Lewis — venue imagery (public static assets)

Drop finalized venue photography and branded visuals here. Vite serves this folder at **`/venue/hub-on-lewis/`**.

## Expected filenames (wired in demo UI)

| File | Use |
|------|-----|
| `exterior-hero.webp` | Exterior · arrival & signage |
| `grand-hall-main.webp` | Grand Hall · main event floor |
| `kitchenette-prep.webp` | Catering prep / kitchenette |
| `gallery-grid-a.webp` | Gallery tile A |
| `gallery-grid-b.webp` | Gallery tile B |
| `river-terrace.webp` | East terrace · river view |

Use **WebP** where possible; dimensions in **`packages/web/src/data/demoVenue.ts`** (`DEMO_VENUE_MEDIA_SLOTS`).

Until files exist, the Settings UI shows **placeholders** with these paths so screenshots stay layout-ready.
