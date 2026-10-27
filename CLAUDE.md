# OpenFoto (Fortepan fork) — working guide

This is the OpenFoto fork of the Fortepan.hu frontend. The lead developer is **Enzo Angiulli**; the person working with Claude here is **Dana**, an interaction designer (HTML/CSS, some JS). Write code the way Enzo does (see "Code style" and the reference files below), and explain changes to Dana in plain language. Point out when Cursor or GitHub Desktop would help Dana.

## Stack at a glance

- **Eleventy 0.11** (static site generator) renders `src/` → `_dist/`. Templates are **Liquid**.
- **Webpack 5** bundles `src/site.js` (JS + SCSS) → `_compiled-assets/main.js|main.css`, which Eleventy copies into `_dist/`. No Babel: JS ships as written.
- **Stimulus 2** (`stimulus` package) for all behaviour. No React/Vue/jQuery.
- **Sass** (dart-sass via sass-loader) + PostCSS/Autoprefixer.
- Backend: a Drupal/Elasticsearch-style REST API (`/api/...`). Photos come from CloudFront (`PHOTO_SOURCE`) via `photoRes()` in `src/js/utils.js`.
- Hosting: Netlify (`netlify.toml`, `functions/`). Content editors used Forestry CMS (`.forestry/`, `*-cms.md` pages, `src/data/notifications.json`).
- Node **12** (`.nvmrc`). npm, not pnpm, is what the README uses.

## Commands

- `npm run dev` → clean, import autocomplete data, webpack, then webpack watch + `eleventy --serve` on **http://localhost:8080** (browser-sync UI on 3001). The app's preview config is `.claude/launch.json` (`fortepan-dev`).
- `npm run build` → production build into `_dist/`.
- Changes to `.eleventy.js` need a server restart. Changes to `src/data/*.js` rebuild both Eleventy and webpack.

## Folder map

```
src/
  site.js            webpack entry: imports scss/styles.scss, js/stimulus, analytics, redirects
  api/               fetch wrappers per domain: search.js, lists.js, auth.js, tags.js, autosuggest.js
  components/<name>/ <name>.liquid + <name>-controller.js + <name>.scss  (auto-registered)
  layouts/<name>/    page layouts, same trio; base/base.liquid is the root layout
  pages/<locale>/    markdown pages per locale (en, hu, it, pl, fr); front matter picks layout + permalink
  data/              Eleventy global data, ALSO imported by browser JS (see warning below)
    siteConfig.js    URLs, keys, breakpoints, locales. LOCAL ONLY (git-ignored since Enzo's
                     a2d098c); copy from siteConfig.js.example. Shared changes go in the .example
    lang.js          all UI strings: { hu: {...}, en: {...}, it, pl, fr }
  js/                app.js (body-class app state), utils.js, photo-manager.js, list-manager.js, stimulus.js
  scss/              globals: utils (rem()), breakpoints, colors, typography, helpers, layout, scopes
  static/            copied as-is (images/icons/24/*.svg used via inlineSVG)
plugins/inlineSVG.js custom Liquid tag {% inlineSVG src:"..." class:"..." %}
```

## How a feature is built (follow this pattern)

Use Enzo's map feature (commit `5eece40`) as the reference: `src/components/mapview/`, `src/components/mapmarker/`, `src/layouts/map/`, `src/pages/*/map.md`.

1. **Component folder** `src/components/foo/` with:
   - `foo.liquid`: markup with `data-controller="foo"`, targets as `data-foo-target="name"`, actions as `data-action="click->foo#onClick"`. Reusable markup that JS clones goes in `<template id="foo-template">`.
   - `foo-controller.js`: `export default class extends Controller`. Declare targets with `static get targets() { return ["name"] }` (getter form, **not** class fields). Use `connect()` for setup.
   - `foo.scss`: BEM-ish block `.foo`, elements `&__part`, modifiers/states `is-visible`, `is-selected`, `is-single`.
   - Controllers in `components/` and `layouts/` are auto-registered by `src/js/stimulus.js`; `foo/foo-controller.js` becomes the identifier `foo`. SCSS is auto-imported by the glob in `scss/styles.scss`. Nothing needs registering by hand.
2. **Include it** from a layout: `{% include foo/foo.liquid %}`.
3. **New page**: add `src/pages/<locale>/foo.md` for **every** locale with front matter `layout`, `title`, `permalink: /<locale>/foo/`. `en`/`hu`/`it`/`pl` get `locale` from `<locale>.11tydata.json`; `fr`'s data file is misnamed (`fr/en.11tydata.json`), so **fr pages set `locale: fr` in front matter**.
4. **Strings**: add keys to every locale in `src/data/lang.js` (group feature strings in a nested object like `map: { menu_label, no_results }`). In Liquid: `{{ lang[locale].key }}`, with `| default: lang.en.key` if a locale might lack it. In JS: `lang("key")` from `js/utils` (returns the key itself if missing).
5. **Nav links** live in `src/components/header-nav/header-nav.liquid` (desktop top links plus a `--hide-on-desktop` copy in the menu).

## Communication between pieces

- **Events, not imports**, between controllers: `trigger("mapview:show", { ...detail })` from `js/utils`, listened to in markup with `data-action="mapview:show@document->mapview#show"`. Event names are `component:verb`.
- **Global app state = classes on `<body>`**: `appState("is-map")`, `setAppState`, `removeAppState`, `toggleAppState` from `js/app`. Examples: `is-dev`, `is-map`, `theme--light`/`theme--dark`. CSS can key off these.
- Common UI events: `loader:show` / `loader:hide` (`{ id: "loaderBase" }`), `snackbar:show` (`{ message, status: "error", autoHide }`), `snackbar:hide`.
- Data loading goes through `js/photo-manager.js` → `api/search.js`. URL state through `getURLParams()`.

## Code style (match Enzo)

- Prettier: **no semicolons**, double quotes, 2 spaces, 120-char lines, trailing commas (es5). ESLint airbnb-base + prettier.
- Imports: `stimulus` first, external packages, blank line, then relative imports (`../../js/utils`, etc.).
- Module constants in `UPPER_SNAKE` at the top (`MAX_INDIVIDUAL_MARKERS`, `MARKER_PHOTO_LIMIT`).
- Bound handlers are stored in `connect()`: `this.boundLoad = this.load.bind(this)`.
- Event handlers named `onSomething`; call `e.preventDefault()` / `e.stopPropagation()` explicitly.
- `async/await` is fine; prefer `Promise.all` for parallel loads. Keep optional chaining out to match existing code.
- Comments are sparse, short and explain *why*.
- SCSS: sizes with `rem(16px)` (defined in `scss/utils.scss`); colors from `scss/colors.scss` (`$light-base`, `$dark-secondary`, `$red`, ...); breakpoints `@media screen and (max-width: ($breakpoint-desktop - 1px))`; theme variants with `.theme--light &` / `.theme--dark &`; fonts via mixins `font-body`, `font-heading-bold`, `font-heading-demi` and classes `.h1`/`.h3`/`.caption`.
- Commit messages: short, often prefixed `Feat:` / `Fix:` / `chore:` (e.g. "Feat: Geotagging Map View").

## ⚠️ Gotchas

- **`src/data/*.js` runs in two places**: Node (Eleventy build) and the browser (webpack imports `siteConfig.js` and `lang.js`). Never `require` Node-only modules (`dotenv`, `fs`) there, and guard `process` access: only `process.env.ENV` is defined in the browser (webpack DefinePlugin). `.env` is loaded in `.eleventy.js`. A mistake here kills all JS: no photos, half-styled page.
- `src/layouts/map/map.scss` uses `torem(...)`, which isn't defined (the helper is `rem()`), so those `top:` rules compile to invalid CSS and are ignored. Use `rem()`; ask Dana before fixing Enzo's code.
- `torem()` exists on `master` (fortepan.hu) but not on this line; code copied from master must be converted to `rem()`.
- The old backend (`backend.fortepan.eu`) is slow: homepage requests take ~5–15 s each. That's server latency, not a code problem; design loading states for it.
- `api/lists.js` and `api/tags.js` switch between `*_DEV` and prod URLs via `appState("is-dev")`; `api/search.js` always uses `config.BACKEND`.
- Ignore the Forestry-generated commits and `notifications.json` churn; content editors own those.

## Local dev setup specific to this fork (as of 2026-10)

- `api.openfoto.org` / `back.openfoto.org` are **not live yet**. In development `BACKEND` and `BACKEND_DEV` are `""`, and browser-sync middleware in `.eleventy.js` proxies `/api` to `DEV_API_PROXY_TARGET` (`https://backend.fortepan.eu`) to avoid CORS. Once Enzo's backend is live, change `DEV_API_PROXY_TARGET`.
- The old backend has **no geo support**: the map loads, but it shows no pins until the new backend is available.
- If `src/data/siteConfig.js` is missing (e.g. after a pull), the build fails silently: no CSS/JS. Recreate it from the `.example` with real values, then restart `npm run dev` (webpack watch doesn't recover from a failed first build).
- Google Maps: the prod key only allows the live domain (Enzo rotated it in Oct 2026; the new one isn't in the repo). Dana's personal dev key is in `.env` as `GOOGLE_MAPS_KEY_DEV` (git-ignored; never print or commit it); dev uses `DEMO_MAP_ID` unless `GOOGLE_MAPS_ID_DEV` is set.

## Working with Dana

- Work on a branch per change; `openfoto` is the working branch, `master` is upstream.
- Before calling something done: check it in the browser preview (`localhost:8080`), including the console for errors.
- Explain what changed and why in plain terms; mention the files so Dana can open them in Cursor and review the diff in GitHub Desktop.
