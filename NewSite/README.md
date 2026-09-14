# HuB on Lewis — Marketing Site

Premium static marketing website for **HuB on Lewis** (Wichita event venue + coworking).  
Vite + vanilla HTML/CSS/JS. Photo-forward editorial design with real venue photography.

## Quick start

```bash
cd NewSite
npm install
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`).

### Production build

```bash
npm run build
npm run preview   # optional: serve dist/
```

Output lands in `dist/`. Deploy that folder to any static host.

## Brand & photography

| Path | Purpose |
|------|---------|
| `public/brand/logo.svg` | Primary wordmark |
| `public/brand/logo-light.svg` | Light wordmark for dark footers |
| `public/favicon.svg` | Browser icon |
| `public/images/real/named/*.jpg` | Real venue photos used throughout the site |

All major sections use real JPGs from `public/images/real/named/`. No gray photo boxes.

## Key links (live)

- **Book / Check availability:** https://the-hub-qy8a.onrender.com/book  
- **Office waitlist:** Google Form (linked in Offices + Contact)  
- **Email:** info@hubonlewis.com  

Inquiry form builds a `mailto:` draft (no server).

## Sections

Hero · Gatherings · The Space (capacity 99) · Amenities · How booking works · Gallery + lightbox · Offices (leased / waitlist) · Location · FAQ · Contact · Sticky header CTA · Mobile persistent CTA

## Facts used on-site

- Events: birthdays, baby showers, business & networking, fundraisers & receptions  
- Capacity: up to 99 guests · indoor + outdoor · full kitchen · tables & chairs · audio  
- Offices: Small 100 sq ft $320/mo · Large 150 sq ft $450/mo — both leased → waitlist  
- Amenities: 24/7 access, high-speed internet, kitchen, large meeting space, conference room, networking events  

## Notes

- No fake testimonials / no lorem ipsum.  
- See `DESIGN.md` for visual system.  
