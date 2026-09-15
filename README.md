# SDC Engine

Internal workspace for the SIIDigitalCreative team — built with Next.js (App Router) + Tailwind, deployable on Vercel.

## Pages
- `/dashboard` — per-member dashboard (counts, day tasks, mini calendar, schedule)
- `/calendar` — team calendar (month / week / day)
- `/tasks` — task board + list
- `/team` — team member cards

`/` redirects to `/dashboard`.

## Run locally
```bash
npm install
npm run dev
```
Open http://localhost:3000

## Deploy
1. Create a new empty repo on GitHub.
2. In this folder:
   ```bash
   git init
   git add .
   git commit -m "Initial: SDC Engine"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
3. On vercel.com → New Project → import the repo → Deploy (framework auto-detects as Next.js, no config needed).

## Notes
- Each page is self-contained (its own sidebar, theme, and dark/light toggle). Making the sidebar a single shared layout so the nav links between pages and the theme persists is the recommended next step.
- Colors, the accent gradient, and the light/dark tokens live at the top of each page file and in the injected style block.
