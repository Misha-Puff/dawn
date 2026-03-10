# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About This Repo

This is a customized fork of Shopify's **Dawn** theme (v15.4.1) for the **Misha Puff** store, tracked on the `misha-puff-main` branch. Upstream changes from Shopify's Dawn are periodically merged in.

To pull upstream Dawn updates:
```sh
git fetch upstream
git pull upstream main
```

## Development Commands

```sh
# Local development server (connects to Shopify store)
shopify theme dev

# Lint all Liquid, JSON, and assets
shopify theme check

# Push theme to store
shopify theme push
```

No Node.js/npm build step — this is a Liquid theme with no bundler.

## Code Formatting

- **Prettier** — JS/CSS: single quotes, 120 print width; Liquid: double quotes
- VS Code auto-formats on save if the recommended extensions are installed (`.vscode/extensions.json`)

## Architecture

This is an **HTML-first, server-rendered** Shopify theme. Core principles:

- **No client-side frameworks** — vanilla JS only, used sparingly for progressive enhancement
- **Server-rendered via Liquid** — business logic and translations stay on the server
- **Zero CLS target** — no DOM manipulation before user input, no render-blocking JS

### Directory Layout

| Directory | Purpose |
|-----------|---------|
| `sections/` | Reusable Liquid components rendered in the theme editor (cart-drawer, announcement-bar, etc.) |
| `templates/` | Page-type templates (product, collection, cart, etc.) — includes Shogun page builder variants |
| `snippets/` | Small reusable Liquid partials included via `{% render %}` |
| `assets/` | CSS, JS, and SVG files served as static assets |
| `layout/` | Root layout files; `theme.liquid` is the main wrapper |
| `config/` | `settings_schema.json` (editor UI) and `settings_data.json` (current values) |
| `locales/` | `en.default.json` (buyer-facing) and `en.default.schema.json` (merchant admin) |

### Third-Party Integrations

The theme includes page builder integrations that are **excluded from Theme Check linting**:
- Gem Pages: `layout/theme.gem-*.liquid`, `templates/page.gem-*.liquid`
- Gempages: `layout/theme.gempages.*.liquid`, `sections/gp-*.liquid`
- Shogun: `layout/theme.shogun.*.liquid`, `sections/shogun-*.liquid`, `snippets/shogun-*.liquid`

**IMPORTANT:** Never index, read, or write to any file whose name contains `gem`, `gempages`, `shogun`, `gp-`, `shogun-`, or `gem-`. These files are managed solely by the Shogun and Gempages apps.

### Custom Elements / JavaScript Pattern

JS is written as native Web Components (custom elements). Look in `assets/*.js` — each file typically defines a single custom element class (e.g., `cart-drawer.js` → `<cart-drawer>`). Extend `HTMLElement` directly; no framework.

## Theme Check Configuration

`.theme-check.yml` extends `theme-check:all` with `AssetSizeJavaScript` disabled and third-party integration paths ignored. CI runs Theme Check on every push via `.github/workflows/ci.yml`.
