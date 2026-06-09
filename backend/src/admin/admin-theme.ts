// Delfee brand-accent theme for the whole Medusa admin.
//
// We only recolor Medusa's *interactive / brand* tokens (which default to a
// blue) to the storefront palette — plum for the accent + primary buttons,
// gold for focus rings. Neutral surfaces and text keep Medusa's own values so
// the data-dense admin stays readable. Injected globally into the admin
// index.html via the admin `vite` transformIndexHtml hook in medusa-config.ts,
// so it applies on every admin page. Our <style> is placed after Medusa's
// stylesheet, so these overrides win without needing !important.
//
// Storefront colors: plum #5D2E46, plum-deep #431830, plum-light #D596B3,
// gold #D4AF37.
export const ADMIN_THEME_CSS = `
:root {
  --bg-interactive: #5D2E46;
  --fg-interactive: #5D2E46;
  --fg-interactive-hover: #431830;
  --border-interactive: #5D2E46;
  --button-inverted: #5D2E46;
  --button-inverted-hover: #431830;
}
.dark {
  --bg-interactive: #7A3D5E;
  --fg-interactive: #D596B3;
  --fg-interactive-hover: #E6B9CD;
  --border-interactive: #7A3D5E;
  --button-inverted: #5D2E46;
  --button-inverted-hover: #431830;
}
:root, .dark {
  --borders-focus: 0 0 0 2px var(--bg-base), 0 0 0 4px rgba(212,175,55,.6);
  --borders-interactive-with-focus: 0 0 0 1px #5D2E46, 0 0 0 2px var(--bg-base), 0 0 0 4px rgba(212,175,55,.6);
  --borders-interactive-with-active: 0 0 0 1px #5D2E46, 0 0 0 4px rgba(212,175,55,.25);
  --buttons-inverted-focus: 0 0 0 2px var(--bg-base), 0 0 0 4px rgba(212,175,55,.6);
  --buttons-neutral-focus: 0 0 0 2px var(--bg-base), 0 0 0 4px rgba(212,175,55,.6);
}
`
