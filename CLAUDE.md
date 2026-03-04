# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pyra.js is a full-stack web framework built as a TypeScript monorepo using pnpm workspaces. It provides file-based routing with SSR (server-side rendering), an HMR dev server, esbuild-based production builds, request tracing, and a CLI with project scaffolding. The architecture is framework-agnostic — the `PyraAdapter` interface decouples the UI framework from the core runtime. The React adapter (`@pyra-js/adapter-react`) is the reference implementation.

## Monorepo Structure

Five packages with strict build order: **shared → core + adapter-react → cli + create-pyra**

- **packages/shared** (`@pyra-js/shared`) — Types (`types.ts`), config loader (`config-loader.ts`), env loader (`env-loader.ts`), logger (`logger.ts`), network utilities (`net-utils.ts`)
- **packages/core** (`@pyra-js/core`) — Dev server with HMR, production server, esbuild bundler with caching, file-based route scanner, trie-based router, middleware runner, request context, request tracer, metrics collection, build orchestrator, CORS, CSS extraction, image optimization plugin
- **packages/adapter-react** (`@pyra-js/adapter-react`) — React SSR adapter implementing `PyraAdapter` interface. Exports `createReactAdapter()`, `<Link>`, `<Image>`. Uses `renderToString()` for server rendering and a persistent `PyraApp` shell with `hydrateRoot()` for client-side navigation.
- **packages/cli** (`@pyra-js/cli`) — CLI commands (`bin.ts` entry point), interactive scaffolding (`commands/init.ts`), package manager detection (`pm.ts`), dependency graph visualization (`graph/`), project diagnostics (`commands/doctor.ts`), dev/prod banners, keyboard shortcuts, templates. Re-exports user-facing types from `@pyra-js/shared`.
- **packages/create-pyra** (`create-pyra`) — Standalone scaffolder for `npm create pyra`. Interactive prompts, template copying, post-copy patching (`patches.ts`), Tailwind integration.
- **packages/compat-pyrajs-\*** — Compat shims re-exporting from `@pyra-js/*` for backward compatibility with old `pyrajs-*` package names. Published at same version as main packages.

## Build & Development Commands

```bash
# Install dependencies
pnpm install

# Build all packages (respects build order)
pnpm build

# Link CLI globally for testing
pnpm dev:link        # runs pnpm build && cd packages/cli && npm link

# Remove global CLI link
pnpm dev:unlink

# Type checking across all packages
pnpm typecheck

# Run tests
pnpm test
pnpm test:watch
pnpm test:coverage

# Clean build artifacts
pnpm clean

# Run CLI in development without building
cd packages/cli && pnpm dev:run

# Publish all packages (syncs compat versions, builds, publishes)
./scripts/publish-all.sh
./scripts/publish-all.sh --dry-run
```

Individual packages are built with `tsup`. The CLI build also runs `scripts/copy-templates.mjs` to copy template files to `dist/templates/`.

## CLI Commands

The CLI entry point is `packages/cli/src/bin.ts`. Main commands:

- `pyra dev` — Start dev server with HMR (HTTP + WebSocket). Options: `--port`, `--open`, `--config`, `--mode`, `--verbose`
- `pyra build` — Production build via esbuild. Options: `--out-dir`, `--minify`, `--sourcemap`, `--config`, `--mode`, `--silent`
- `pyra start` — Start production server (requires `pyra build` first). Options: `--port`, `--config`, `--dist`, `--silent`
- `pyra init [name]` — Interactive scaffolding with template/language/Tailwind/React Compiler selection. Options: `--template`, `--language`, `--pm`, `--tailwind`, `--ui`, `--skip-install`, `--force`, `--silent`
- `pyra graph [path]` — Dependency graph visualization. Formats: html/svg/png/mermaid/dot/json. Options: `--format`, `--outfile`, `--open`, `--internal-only`, `--external-only`, `--filter`, `--hide-dev`, `--hide-peer`, `--cycles`, `--stats`, `--pm`, `--json`, `--silent`
- `pyra doctor` — Diagnose project setup (detects SSR vs SPA mode, validates config, scans routes). Options: `--config`, `--silent`

All three server commands (`dev`, `build`, `start`) require `config.adapter` to be set — they error with a helpful message if it is missing. The adapter is **never** hardcoded in the CLI; it must come from the project's `pyra.config.ts`.

## Configuration System

Config loader is in `packages/shared/src/config-loader.ts`. Auto-discovers files in order: `pyra.config.ts` → `.js` → `.mjs` → `.cjs` → `.pyrarc.ts` → `.pyrarc.js` → `.pyrarc.mjs`. Supports static objects, mode-aware functions (`defineConfigFn`), and async configs. Priority: defaults < config file < CLI flags.

Key config fields: `root`, `entry`, `routesDir` (default `src/routes`), `adapter` (required — a `PyraAdapter` instance), `server` (DevServerConfig), `build` (BuildConfig), `resolve`, `env`, `plugins`, `trace` (`{ production: 'off' | 'header' | 'on', bufferSize }`), `buildReport` (`{ warnSize }`).

## Key Architecture Details

### Routing & SSR Pipeline

- **Scanner** (`core/src/scanner.ts`): Recursively walks `src/routes/` discovering `page.tsx` (pages), `route.ts` (APIs), `layout.tsx` (layouts), `middleware.ts` (middleware), `error.tsx` (error boundaries), `404.tsx` (not-found page). Supports route groups `(name)`, dynamic segments `[slug]`, catch-all `[...path]`. Validates no route collisions and resolves layout/middleware/error ancestry.
- **Router** (`core/src/router.ts`): Trie-based URL matching with priority: static > dynamic > catch-all. Built from `ScanResult` via `createRouter()`. Matches return `RouteMatch` with route, params, and layout chain.
- **Middleware** (`core/src/middleware.ts`): `runMiddleware()` executes a chain of `Middleware` functions with `next()` pattern. Short-circuits if middleware returns a Response without calling `next()`.
- **Request Context** (`core/src/request-context.ts`): Builds `RequestContext` from Node's `IncomingMessage`. Includes Web standard `Request`, `URL`, params, `CookieJar`, env vars (filtered by `PYRA_` prefix), and response helpers (`json()`, `html()`, `redirect()`, `text()`). Also exports `createBuildTimeRequestContext()` for SSG prerendering.

### Servers

- **DevServer** (`core/src/dev/dev-server.ts`): HTTP server with WebSocket HMR. Modular handlers split across `dev-ssr.ts`, `dev-api.ts`, `dev-static.ts`, `dev-errors.ts`, `dev-proxy.ts`, `dev-dashboard.ts`. Pipeline: route match → compile → load → render → inject assets. Special endpoints: `/__pyra/modules/*` (JS bundles), `/__pyra/styles/*` (extracted CSS as `text/css`), `/_pyra` (dashboard UI), `/_pyra/navigate` (client-side navigation JSON), `/_pyra/image` (on-demand image optimization), `/_pyra/api/traces` (trace API). HMR client at `/__pyra_hmr_client`.
- **ProdServer** (`core/src/prod/prod-server.ts`): Serves prebuilt assets from `dist/`. Manifest-driven asset injection. Graceful shutdown with `inflightCount` tracking (503 during shutdown, 10s drain timeout). Conditional request tracing via `shouldTrace()`. Endpoint `/_pyra/navigate` for client-side navigation. Endpoint `/_pyra/image` serves pre-built image variants.

### Build System

- **Bundler** (`core/src/bundler.ts`): Wraps esbuild with an in-memory cache (5-second TTL). Maintains a separate `cssOutputCache` — CSS extracted from browser-platform builds stored here and exposed via `getCSSOutput(filePath)`. Both caches cleared by `clearBundleCache()` and `invalidateDependentCache()`.
- **Build Orchestrator** (`core/src/build/build-orchestrator.ts`): Production build producing `dist/client/` + `dist/server/` + `dist/manifest.json`. Per-route hydration entries, esbuild code splitting with content hashing, export detection via metafile. Prerender support (static and dynamic with `paths()`). Build report with sizes, modes, shared chunks, gzip estimates, size warnings.

### Client-Side Navigation

- **`/_pyra/navigate` endpoint**: Available in both dev and prod. Accepts `?path=` query param. Runs middleware chain + `load()`, returns JSON `{ data, clientEntry, layoutClientEntries, routeId }`. Redirects returned as `{ redirect: location }`.
- **`PyraApp` shell**: `getHydrationScript()` generates a persistent React component using `useState`/`useEffect` instead of a one-shot `hydrateRoot()`. Swaps page component and data on navigation. Compares layout chains — falls back to full reload if layouts differ.
- **`<Link>` component** (`adapter-react/src/Link.tsx`): Intercepts same-origin clicks, passes through modifier-key clicks (Cmd/Ctrl/Shift/Alt), calls `window.__pyra.navigate()`. Falls back to `location.href` if navigate not registered.

### Transparency Layer

- **RequestTracer** (`core/src/tracer.ts`): Per-request timing via `performance.now()`. `start()`/`end()` pairs for pipeline stages. Produces `Server-Timing` headers (W3C format), tree-style terminal logs with bottleneck highlighting (yellow >50%, red >80%), and `RequestTrace` objects.
- **MetricsStore** (`core/src/metrics.ts`): Singleton collecting build metrics (last 50), HMR events (last 100), dependency graph data, and request traces (ring buffer, default 200). `routeStats()` computes avg/p50/p95/p99 response times per route.

### React Adapter

- **Adapter** (`adapter-react/src/adapter.ts`): Implements `PyraAdapter` interface. `name: "react"`, `fileExtensions: [".tsx", ".jsx"]`. `renderToHTML()` uses `createElement` + `renderToString()` with layout wrapping (outermost first). `getHydrationScript()` generates the `PyraApp` persistent shell with layout imports and `useState`/`useEffect`. `getDocumentShell()` returns HTML template with `<!--pyra-head-->` and `<!--pyra-outlet-->` markers.
- **`<Image>`** (`adapter-react/src/Image.tsx`): Generates responsive `<picture>` with `<source>` tags + fallback `<img>`. Uses `/_pyra/image` endpoint.
- **`<Link>`** (`adapter-react/src/Link.tsx`): Client-side navigation. See above.

### CLI Utilities

- **Package Manager Detection** (`cli/src/pm.ts`): Detects npm/pnpm/yarn/bun via lockfile presence → `npm_config_user_agent` → PATH availability → user prompt.
- **Graph System** (`cli/src/graph/`): `buildGraph.ts` analyzes package.json files and lockfiles. Serializers output dot, html, json, and mermaid formats. Supports workspace detection, cycle detection, filtering, directed arrows, workspace color palette, in-degree badges.
- **Templates** (`cli/templates/`): `react-ts-fullstack`, `react-js-fullstack`, `react-ts-spa`, `react-js-spa`, `vanilla-ts`, `vanilla-js`. Copied to `dist/templates/` at build time. Full-stack templates include `pyra.config.ts` with `createReactAdapter()`, `style.css` in `src/routes/`, imported in `layout.tsx`. `{{PROJECT_NAME}}` and `{{PYRA_VERSION}}` placeholders replaced at scaffold time.
- **Reporter** (`cli/src/utils/reporter.ts`): `withBanner()` wraps command execution with timing and banner display. Respects `--silent` flag and `PYRA_SILENT` env var.
- **Keyboard Shortcuts** (`cli/src/utils/keyboard.ts`): TTY keyboard shortcuts for dev/prod servers (restart, quit, open browser, clear).
- **Dev Banner** (`cli/src/utils/dev-banner.ts`): Styled startup banners for dev and production servers with capability detection (Unicode, color, CI).
- **Doctor** (`cli/src/commands/doctor.ts`): Project diagnostics — detects project mode (Static SPA vs Full-Stack SSR vs Misconfigured), validates config, scans routes, checks adapter. Uses `config.adapter === false` to detect intentionally adapter-less (SPA) mode.

### create-pyra

- **`packages/create-pyra/src/index.ts`**: Main scaffolding for `npm create pyra`. Prompts: project name, framework (vanilla/react/preact), app mode (SSR/SPA), language (TS/JS), Tailwind, React Compiler. Copies template from `template-{framework}-{ts|js}/` directory.
- **`packages/create-pyra/src/patches.ts`**: Post-copy patching system — applies targeted file modifications after template copy (e.g., React Router or TanStack Router setup, React Compiler config).
- **Tailwind scaffolding**: For full-stack (SSR) mode, prepends `@tailwind` directives to existing `style.css` (preserving template styles). For SPA/vanilla, creates a new `index.css` and injects the import.
- **Templates**: `template-react-ts`, `template-react-js`, `template-preact-ts`, `template-preact-js`, `template-vanilla-ts`, `template-vanilla-js` plus SPA variants. All React full-stack templates include `@pyra-js/adapter-react` in dependencies and `createReactAdapter()` in `pyra.config`.

## Type System

Core types are in `packages/shared/src/types.ts`. Key types:

- `PyraConfig` — Full config object. `adapter` field is `string | PyraAdapter | false` — use `false` for intentional SPA (no SSR), `PyraAdapter` instance for full-stack. String form is reserved but not currently used.
- `PyraAdapter` — Framework adapter interface: `name`, `fileExtensions`, `esbuildPlugins()`, `renderToHTML(component, data, context)`, `getHydrationScript(clientEntryPath, containerId, layoutClientPaths?)`, `getDocumentShell()`
- `RouteNode` — Route definition (id, pattern, filePath, type, params, catchAll, layoutId, middlewarePaths, errorBoundaryId, children)
- `RouteGraph` — Router interface (nodes, match, get, pageRoutes, apiRoutes, toJSON)
- `RequestContext` — Per-request context (request, url, params, headers, cookies, env, mode, routeId, json/html/redirect/text helpers)
- `Middleware` — `(context, next) => Response | Promise<Response>`
- `RenderContext` — Passed to adapter: component, data, params, layouts array, error (for error boundaries)
- `RequestTrace` / `TraceStage` — Request tracing data structures
- `RouteManifest` / `ManifestRouteEntry` — Build manifest types (includes clientEntry, layoutClientEntries, hasLoad, middleware, prerendered, cache, errorBoundaryEntry)
- `ImageFormat`, `ImageConfig`, `ImageVariant`, `ImageManifestEntry` — Image optimization types
- `defineConfig()` / `defineConfigFn()` — Config helper functions (re-exported from `@pyra-js/cli`)

User-facing types (`RequestContext`, `Middleware`, `ErrorPageProps`, `CacheConfig`, `PrerenderConfig`, `defineConfig`, `defineConfigFn`) are re-exported from `@pyra-js/cli` — application developers never need to import from `@pyra-js/shared` directly.

## Documentation

All docs live in `docs/`:

- `adapter-react.md` — React adapter: setup, `<Link>`, `<Image>`, SSR internals, TypeScript config
- `adapters.md` — Framework adapter architecture and `PyraAdapter` interface
- `api-routes.md` — Building API routes with HTTP method handlers
- `ci.md` / `ci-cd.mdx` — CI/CD integration guides
- `cli-reference.md` — Complete CLI command reference
- `configuration.md` — Configuration system (all fields, discovery order, mode-aware configs)
- `cookies.md` — Cookie handling in routes and middleware
- `cors.md` — CORS configuration via `cors.ts`
- `dashboard.md` — Dev server dashboard UI (`/_pyra`)
- `Dev-server.md` — Development server internals
- `env.md` — Environment variables (`PYRA_` prefix, `.env` files)
- `image-optimization.mdx` — `pyraImages()` plugin + `<Image>` component guide
- `layouts.md` — Layout nesting, route groups, what layouts can't do
- `middleware.md` — Middleware creation, stacking, and auth patterns
- `pages.md` — Page files: static/dynamic/catch-all routes, `load()`, prerendering, cache control
- `plugins.mdx` — Plugin API documentation
- `request-context.md` — `RequestContext` interface and all helpers
- `request-tracing.md` — Request tracing, Server-Timing headers, dashboard metrics
- `routing.md` — File-based routing overview, route types, priority, navigation
- `ssr-and-data-loading.md` — SSR pipeline, `load()` function, hydration
- `testing.mdx` — Testing guide
- `tutorial-todo-app.md` — Beginner-friendly full-stack todo app tutorial

## Tech Stack

- TypeScript (ES2020, strict mode, bundler module resolution)
- tsup for package builds
- esbuild ^0.25.0 for bundling
- Commander.js for CLI argument parsing
- @inquirer/prompts for interactive `pyra init` prompts
- @clack/prompts for interactive `create-pyra` prompts
- chokidar ^4.0.3 for file watching (HMR)
- ws ^8.18.0 for WebSocket HMR
- picocolors / chalk for terminal output
- sharp >=0.33.0 (optional peer dep of `@pyra-js/core` for image optimization)
- React 18/19 (peer dependency of `@pyra-js/adapter-react`)
- Node.js >=18.0.0, ESM output format
- pnpm 10.x as package manager
- vitest for testing
