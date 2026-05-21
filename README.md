# foodweb.ai

Marketing site for ROA by FoodWeb. Astro + React islands, static-exported, deployed to Firebase Hosting.

## Stack

- **Astro 5** — static site generator with file-based routing
- **React 18** — used as islands only (theme toggle, pricing modal, hero phone). Most of the site ships zero JS.
- **MDX** — blog content via Astro Content Collections
- **TypeScript** — strict mode
- **Firebase Hosting** — static hosting

## Project layout

```
src/
  pages/                  file-based routes
    index.astro             landing page
    contact.astro
    404.astro
    blog/
      index.astro             blog index (lists Content Collection)
      [...slug].astro         blog post template (getStaticPaths)
    legal/
      privacy.astro
      terms.astro
  layouts/
    BaseLayout.astro        HTML shell, fonts, theme bootstrap, nav, footer
    LegalLayout.astro       shared frame for privacy/terms
  components/
    Nav.astro Footer.astro Logo.astro
    sections/               landing-page sections (Hero, Features, Marquee, BlogTeaser, Team, CTA)
    islands/                React components (ThemeToggle, PricingModal, HeroPhone) — hydrated client-side
  content/
    config.ts               blog Content Collection schema (zod)
    blog/                   .mdx posts with frontmatter (title, description, date, tag, …)
  lib/                      pure helpers (theme, blog queries, feature data)
  styles/global.css         design tokens, fonts, animations, reset
public/
  fonts/                  Poppins TTFs (served as static)
  assets/                 logos, profile photos
  uploads/                product screenshots
```

## Adding a blog post

1. Drop a new `.mdx` file in `src/content/blog/`.
2. Frontmatter — required: `title`, `description`, `date`. Optional: `tag`, `author`, `minutes`, `cover`, `draft`.
3. Write MDX. The post auto-appears on `/blog` and at `/blog/<file-slug>`.

The schema lives in `src/content/config.ts` and is enforced at build time.

## Adding a route

Drop a new `.astro` file in `src/pages/`. The route mirrors the path. Wrap the page in `BaseLayout` to inherit nav/footer/theme.

## Adding an interactive widget

Add a React component to `src/components/islands/`, then mount it from any `.astro` file with a client directive:

```astro
<MyWidget client:visible />
```

Directives: `client:load` (immediate), `client:visible` (on scroll into view — default for most widgets), `client:idle` (when main thread is free).

## Theming

Dark is default. The toggle in the nav writes `data-theme="light|dark"` on `<html>` and persists to `localStorage`. CSS tokens in `src/styles/global.css` adapt accordingly. A blocking inline script in `BaseLayout` reads the stored value before paint to avoid FOUC.

## Local development

```bash
yarn install
yarn dev         # http://localhost:4321
yarn build       # → dist/
yarn preview     # serve dist/ locally
yarn astro check # type-check .astro + .ts + .tsx
```

## Deploying to Firebase

```bash
# one-time: log in and set the project
firebase login
firebase use foodweb-ai          # or edit .firebaserc

# deploy
yarn build && firebase deploy --only hosting
# shorthand:
yarn deploy
```

`firebase.json` is preconfigured for:

- `public: dist`
- `cleanUrls: true` (so `/blog/foo` works without the `.html`)
- Long-term immutable cache on hashed `_assets/*`
- No-cache on HTML so deploys roll out immediately
- SPA-style fallback to `/404.html`

## Notes

- Reference designs are in `.reference-design/` and gitignored. They're the original HTML/JS prototypes from Claude Design.
- `_redirects` and `_headers` aren't used — Firebase Hosting uses `firebase.json`.
- The blog `index.id` slug is derived from the MDX filename; rename files carefully (it'll change the URL).
