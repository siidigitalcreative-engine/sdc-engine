# SDC Engine

Internal workspace for the SIIDigitalCreative team — Next.js (App Router) + Tailwind, deployable on Vercel.

## Structure
- `app/layout.jsx` → wraps every route in `AppShell`
- `app/AppShell.jsx` → the persistent frame: page background, rounded card, theme provider, and the shared sidebar
- `app/Sidebar.jsx` → the one shared sidebar (brand, profile, nav links, theme toggle, Settings)
- `app/theme.js` → dark/light context (persisted to localStorage)
- `app/globals.css` → Tailwind + the light/dark design tokens + component hover styles

## Pages
- `/dashboard` — per-member dashboard
- `/calendar` — team calendar (month / week / day) with its own tools panel
- `/tasks` — task board + list
- `/team` — team member cards
- `/projects`, `/reports`, `/settings` — placeholder "Coming soon" pages
- `/` redirects to `/dashboard`

The sidebar persists across pages, the nav links between routes, and the dark/light choice sticks (one toggle in the sidebar).

## Run locally
```bash
npm install
npm run dev
```

## Deploy
1. Push the **contents** of this folder to the repo root (so `package.json` and `app/` sit at the top).
2. Vercel → New Project → import repo → Deploy. Next.js is auto-detected; no config needed.
