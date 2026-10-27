# SignalWire docs navbar

The navbar from signalwire.com/docs, for the generated SDK reference sites.
It works with any doc generator: a post-build step adds it to the generated
HTML, and a small per-site adapter connects its theme control to the site's
own light/dark setting.

Nothing in this directory is specific to one generator, so it can move to a
shared repo for every SDK as it is. Generator-specific code belongs in the
site's adapter, outside this directory.

Ported from the signalwire-python reference (`reference/overrides/main.html`
and `reference/assets/`, at `b2b96b5`).

## Files

| File | Goes | Purpose |
|---|---|---|
| `navbar.html` | inlined after `<body>` | The markup, in a declarative shadow root |
| `document.css` | page `<head>` | Fonts, the bar's height, and its sticky placement |
| `navbar.js` | page `<head>`, `defer` | Dropdowns and the theme control |
| `tokens.css`, `fern.css`, `navbar.css` | loaded by the shadow root | Navbar styles; none of them reach the page |
| `fonts/`, `img/` | | Assets the CSS and markup reference |

## Adding it to a site

Copy this directory, except `navbar.html` and this README, to `navbar/` in the
built site. Then, in every page:

1. Add to `<head>`: `navbar/document.css`, the site's adapter, then
   `navbar/navbar.js` with `defer`. The adapter script must run before
   `navbar.js`.
2. Insert `navbar.html` right after `<body>`, with its comments removed and
   `%NAVBAR%` replaced by the copied directory's path relative to the page,
   ending in `/` (`./navbar/` at the root, `../navbar/` one level down).

## Page layout

The bar is a sticky `<sw-docs-navbar>` element at the top of `<body>`. It
reserves its own height, so the page needs no padding. A page with its own
sticky header or sidebars moves them down by `--sw-docs-navbar-height`, which
`document.css` sets on `:root`.

## Theme adapter

The theme control offers Light, Dark and System. A site whose pages have their
own theme registers an adapter in a script that runs before `navbar.js`:

```js
window.SwDocsNavbar = {
  themeAdapter: {
    get() {},          // the current choice: "light" | "dark" | "system"
    set(pref) {},      // apply and persist a choice the site's own way
    subscribe(cb) {},  // optional: call cb() when the site changes theme itself
  },
};
```

Without an adapter, the navbar keeps the choice in
`localStorage["sw-docs-navbar:theme"]` and only the navbar follows it.

The navbar applies the theme to itself by setting `data-theme` on its own
element. The page's theme is the adapter's job.

All `signalwire.github.io` sites share one origin and so one `localStorage`.
Keep any keys the navbar adds prefixed with `sw-docs-navbar:`. The theme can't
sync with signalwire.com/docs, which is a different origin.
