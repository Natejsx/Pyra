# React Adapter

How Pyra integrates with React for server-side rendering and client-side hydration.

---

## What is the React Adapter?

Pyra's core is framework-agnostic — it handles routing, data loading, middleware, and the request/response pipeline, but it doesn't know how to render UI. That's the adapter's job.

The React adapter (`@pyra-js/adapter-react`) plugs React into Pyra's rendering pipeline. It:

- Renders your page and layout components to HTML on the server using `renderToString()`
- Hydrates the rendered HTML on the client using `hydrateRoot()`
- Provides a `<Link>` component for client-side navigation
- Provides an `<Image>` component for responsive, optimized images

---

## Installation

```bash
npm install @pyra-js/adapter-react react react-dom
```

**Peer dependencies:** `react` and `react-dom` at `^18.0.0` or `^19.0.0`.

If you scaffold a project with `pyra init` or `npm create pyra`, these are already included in the generated `package.json`.

---

## Setup

Pass the adapter to your Pyra config:

```ts
// pyra.config.ts
import { defineConfig } from "@pyra-js/cli";
import { createReactAdapter } from "@pyra-js/adapter-react";

export default defineConfig({
  adapter: createReactAdapter(),
  routesDir: "src/routes",
});
```

That's all the configuration required. From this point, Pyra uses the React adapter for every page render.

---

## The `<Link>` Component

Use `<Link>` anywhere you'd use an `<a>` tag to navigate between pages. It performs client-side navigation — the page component swaps without a full browser reload, keeping the layout mounted and avoiding unnecessary network requests.

```tsx
import { Link } from "@pyra-js/adapter-react";

export default function Nav() {
  return (
    <nav>
      <Link href="/">Home</Link>
      <Link href="/blog">Blog</Link>
      <Link href="/about">About</Link>
    </nav>
  );
}
```

`<Link>` accepts all the same props as a standard `<a>` element — `className`, `style`, `onClick`, etc.

### How it behaves

- **Same-origin links** — intercepted and handled client-side via `window.__pyra.navigate()`
- **External links** — passed through to the browser normally
- **Modifier-key clicks** (Cmd, Ctrl, Shift, Alt) — passed through so the browser can open in a new tab, etc.
- **Different layout chain** — if the destination page uses a different layout than the current page, `<Link>` falls back to a full page load automatically

### Programmatic navigation

For navigating after a form submit or other event, call `window.__pyra.navigate(href)` directly:

```tsx
async function handleSubmit(e) {
  e.preventDefault();
  await saveData();
  window.__pyra.navigate("/dashboard");
}
```

---

## The `<Image>` Component

`<Image>` generates a responsive `<picture>` element with modern format variants (WebP, AVIF) and a fallback `<img>`. It works with the `pyraImages()` plugin to serve optimized images.

```tsx
import { Image } from "@pyra-js/adapter-react";

export default function Hero() {
  return (
    <Image
      src="/images/hero.jpg"
      alt="Mountain landscape"
      width={1280}
      height={720}
      sizes="100vw"
    />
  );
}
```

In development, images are optimized on-demand via a `/_pyra/image` endpoint. In production, pre-built variants are served with immutable cache headers.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | required | Image path relative to `public/` |
| `alt` | `string` | required | Alt text |
| `width` | `number` | — | Intrinsic width — prevents layout shift |
| `height` | `number` | — | Intrinsic height — prevents layout shift |
| `sizes` | `string` | `'100vw'` | CSS `sizes` descriptor for responsive selection |
| `formats` | `string[]` | `['avif', 'webp']` | Format variants, best-first |
| `widths` | `number[]` | `[640, 1280, 1920]` | Width variants to generate |
| `quality` | `number` | `80` | Compression quality 1–100 |
| `loading` | `'lazy' \| 'eager'` | `'lazy'` | Browser loading strategy |
| `className` | `string` | — | Applied to the `<img>` element |
| `style` | `CSSProperties` | — | Inline styles on the `<img>` element |

Enable image optimization in your config:

```ts
import { pyraImages } from "@pyra-js/core";

export default defineConfig({
  adapter: createReactAdapter(),
  plugins: [pyraImages({ formats: ["webp", "avif"] })],
});
```

See the [Image Optimization doc](./image-optimization.mdx) for full details.

---

## How SSR Works

When a request comes in, Pyra calls the adapter through the `PyraAdapter` interface:

1. **Server render** — the adapter receives the page component, the data from `load()`, and the layout chain. It builds the full element tree (page wrapped in layouts, outermost first) and calls `renderToString()` to produce an HTML string.
2. **Shell injection** — Pyra inserts the rendered HTML into the document shell at the `<!--pyra-outlet-->` marker and injects CSS links, script tags, and serialized load data into `<!--pyra-head-->`.
3. **Hydration** — the browser receives the full HTML immediately. A generated `<script type="module">` imports the page component, reads the serialized data from a `<script id="__pyra_data">` tag, and calls `hydrateRoot()` — attaching event handlers to the existing DOM without re-rendering it.

The hydration script also sets up client-side navigation: it mounts a persistent `PyraApp` component that holds the current page component and data in state, swapping them on navigation without unmounting the layout.

---

## TypeScript

The package ships full TypeScript declarations. JSX is compiled by esbuild with `jsx: 'automatic'` and `jsxImportSource: 'react'` — no separate Babel or TSC step is needed for builds.

Add `"jsx": "react-jsx"` to your `tsconfig.json` for editor support:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
```

---

## What the Adapter Doesn't Do

- **No `load()` support in layouts.** Data loading is a page-level feature. If a layout needs data, fetch it in the page's `load()` and pass it down.
- **No React Context across server and client.** Context set during `renderToString()` on the server is not transferred to the client. Use the `load()` → props pattern to pass data instead.
- **No streaming.** Pyra currently uses `renderToString()` (synchronous). Streaming SSR via `renderToPipeableStream()` is not yet supported.

---

## Tips

- **Use `<Link>` instead of `<a>` for internal navigation.** Plain `<a>` tags work, but they cause a full page reload. `<Link>` gives you client-side navigation for free.
- **Don't import React in `load()`.** The `load()` function runs on the server and its code is never bundled into the client. You can use Node APIs, database clients, and server-only packages there without any special configuration.
- **`window.__pyra` is only available in the browser.** Don't access it in components during SSR — guard it with `typeof window !== 'undefined'` if needed.
