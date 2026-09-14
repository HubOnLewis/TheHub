# Design decisions — HuB on Lewis

## Positioning

> *Gatherings that feel personal—not packaged.*

Elevated hospitality site—think Asterisk Denver / Canvas Venue restraint with real photography, not a Canva collage or wireframe of empty photo boxes.

## Palette

| Role | Token | Hex |
|------|-------|-----|
| Warm paper | `--paper` | `#f8f6f1` |
| Paper deep | `--paper-deep` | `#f0ece4` |
| Ink | `--ink` | `#1c1917` |
| Slate | `--ink-soft` | `#2f3d42` |
| Warm brown | `--taupe` | `#453f35` |
| Soft gold | `--accent` | `#b8956c` |

Gold is used sparingly (eyebrows, CTAs, chevrons). Primary buttons are ink; conversion CTAs use soft gold.

## Typography

- **Display:** Cormorant Garamond — headlines, card titles, capacity numeral  
- **Body / UI:** DM Sans — nav, buttons, body copy  

## Photography

Real photos from `public/images/real/named/`:

- Hero: `hero-outdoor.jpg` full-bleed ~90vh with dark gradient overlay  
- Gatherings: `event-indoor*.jpg` as card backgrounds with text overlays  
- Space: indoor/outdoor split + capacity module with `wide-1.jpg`  
- Booking band: `wide-2.jpg` under dark overlay  
- Gallery: masonry of wide / portrait / event / patio shots + lightbox  
- Offices: `office-lifestyle.jpg`, `office-desk.jpg` with leased badges  

All imagery on the live page is real photography from `public/images/real/named/`.

## Motion

Subtle scroll reveal, card hover scale, lightbox fade. Respects `prefers-reduced-motion`.

## Deliberately omitted

- Fake testimonials  
- Lorem ipsum  
- Empty gray photo boxes  
- Weddings as primary event type; interviews/recordings  
