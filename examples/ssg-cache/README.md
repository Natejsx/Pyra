# ssg-cache

Tests Pyra's static site generation (SSG) and cache-control header system.

## What it covers

| Route | Export | Build output |
|---|---|---|
| `/` | *(none)* | SSR — rendered on every request |
| `/about` | `prerender = true` | Single static HTML file |
| `/releases/[version]` | `prerender = { paths() }` | 3 static HTML files (1.0, 1.1, 2.0) |
| `/live` | `cache = { maxAge, sMaxAge, staleWhileRevalidate }` | SSR + `Cache-Control` header |

## Key concepts

- **`prerender = true`**: Pyra renders the page once at build time and writes it to `dist/client/<path>/index.html`. No server needed at runtime for that URL.
- **`prerender = { paths() }`**: For dynamic routes, `paths()` returns the list of param objects to pre-render. One HTML file is produced per entry.
- **`cache`**: Emits `Cache-Control: public, max-age=N, s-maxage=N, stale-while-revalidate=N` on the SSR response. CDN-friendly without giving up on-demand rendering.

## Run

```bash
# Dev mode — SSG pages are rendered on-demand; Cache-Control header is still set
pnpm dev

# Production — see the actual static HTML files in dist/client/
pnpm build && pnpm start
```

After `pyra build`, inspect `dist/client/about/index.html` and `dist/client/releases/` to see the pre-rendered output.
