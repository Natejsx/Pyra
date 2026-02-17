# Configuration

Everything you need to know about configuring Pyra.js — from zero-config defaults to advanced customization.

---

## How Configuration Works

Pyra is designed to work without any configuration at all. Run `pyra dev` in a project and sensible defaults kick in. When you need to customize behavior, create a config file and Pyra picks it up automatically — no flags, no manual imports.

Configuration comes from three sources, merged in this order:

```
Built-in Defaults       (entry: 'src/index.ts', port: 3000, ...)
  ↓ overridden by
Config File             (pyra.config.ts)
  ↓ overridden by
CLI Flags               (--port 8080, --mode production)
```

CLI flags always win. This means you can keep a stable config file and override individual values per command without maintaining separate config files for different environments.

---

## Config File Discovery

When you run any Pyra command (`dev`, `build`, `start`), it searches your project root for a config file in this order:

| Priority | File Name |
|----------|-----------|
| 1 | `pyra.config.ts` |
| 2 | `pyra.config.js` |
| 3 | `pyra.config.mjs` |
| 4 | `pyra.config.cjs` |
| 5 | `.pyrarc.ts` |
| 6 | `.pyrarc.js` |
| 7 | `.pyrarc.mjs` |

Pyra uses the first file it finds and ignores the rest. TypeScript is recommended — you get full IntelliSense and type checking with no extra setup.

If no config file exists, Pyra runs with defaults. No warning, no error. You only need a config file when you want to change something.

---

## Creating a Config File

The simplest way to get started:

```bash
pyra init
```

This creates a `pyra.config.ts` in your project root. You can also create one manually:

```ts
// pyra.config.ts
import { defineConfig } from 'pyrajs-shared';

export default defineConfig({
  port: 8080,
  routesDir: 'src/routes',
});
```

`defineConfig` is a no-op at runtime — it returns the exact object you pass in. Its purpose is to give your editor IntelliSense for every config option, so you get autocomplete and catch typos immediately.

---

## Configuration Types

### Static Configuration

The most common form. Export a plain object:

```ts
import { defineConfig } from 'pyrajs-shared';

export default defineConfig({
  entry: 'src/main.tsx',
  port: 3000,
  build: {
    minify: true,
    sourcemap: false,
  },
});
```

### Mode-Aware Configuration

Use `defineConfigFn` when you need different settings for development and production. The function receives the current mode and returns the config:

```ts
import { defineConfigFn } from 'pyrajs-shared';

export default defineConfigFn((mode) => ({
  build: {
    minify: mode === 'production',
    sourcemap: mode === 'development' ? 'inline' : false,
  },
}));
```

The `mode` value is `'development'` when running `pyra dev` and `'production'` when running `pyra build`.

### Async Configuration

If your config depends on external data (like reading from a file or API), you can return a promise:

```ts
import { defineConfig } from 'pyrajs-shared';

export default defineConfig(async () => {
  const data = await loadSomeExternalConfig();
  return {
    define: { __BUILD_ID__: JSON.stringify(data.buildId) },
  };
});
```

---

## Full Configuration Reference

Here is every option Pyra accepts, grouped by category.

### Core Options

Top-level options that control the basics of your project.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entry` | `string \| string[] \| Record<string, string>` | `'src/index.ts'` | Application entry point(s) |
| `outDir` | `string` | `'dist'` | Output directory for production builds (shorthand for `build.outDir`) |
| `port` | `number` | `3000` | Dev server port (shorthand for `server.port`) |
| `mode` | `'development' \| 'production'` | varies | Build mode. Set automatically by the command (`dev` = development, `build` = production) |
| `root` | `string` | `process.cwd()` | Project root directory |
| `routesDir` | `string` | `'src/routes'` | Directory containing route files, relative to root |
| `appContainerId` | `string` | `'app'` | DOM element ID where the app mounts on the client |
| `renderMode` | `'ssr' \| 'spa' \| 'ssg'` | `'ssr'` | Global rendering mode for all routes. Individual routes can override this |
| `adapter` | `string \| PyraAdapter \| false` | — | UI framework adapter (e.g., `'react'`). Set to `false` for no SSR |
| `define` | `Record<string, any>` | — | Global constants replaced at build time |

```ts
export default defineConfig({
  entry: 'src/main.tsx',
  outDir: 'dist',
  port: 3000,
  root: '.',
  routesDir: 'src/routes',
  appContainerId: 'app',
  renderMode: 'ssr',
  adapter: 'react',
  define: {
    __APP_VERSION__: JSON.stringify('1.0.0'),
  },
});
```

Note that `outDir` and `port` are shorthands. If you also set `build.outDir` or `server.port`, the nested version takes precedence.

---

### Server Options

Control the development server's behavior. Nested under `server`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `3000` | Port to listen on |
| `host` | `string` | `'localhost'` | Host to bind to. Set to `'0.0.0.0'` or `true` for LAN access |
| `https` | `boolean` | `false` | Enable HTTPS for local development |
| `open` | `boolean` | `false` | Open the browser automatically on server start |
| `hmr` | `boolean` | `true` | Enable Hot Module Replacement via WebSocket |
| `cors` | `boolean` | `true` | Enable CORS headers |
| `proxy` | `Record<string, string \| ProxyConfig>` | — | Proxy API requests to another server during development |

```ts
export default defineConfig({
  server: {
    port: 5173,
    host: '0.0.0.0',
    open: true,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
```

Proxying is useful when your API runs on a separate server during development. Pyra forwards matching requests to the target, avoiding CORS issues without changing your frontend code.

If the configured port is already in use, Pyra automatically finds the next available port and tells you which one it picked.

---

### Build Options

Control the production build pipeline. Nested under `build`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `outDir` | `string` | `'dist'` | Output directory |
| `sourcemap` | `boolean \| 'inline' \| 'external'` | `false` | Generate source maps |
| `minify` | `boolean` | `true` | Minify output for production |
| `target` | `string \| string[]` | `'es2020'` | JavaScript target environment |
| `external` | `string[]` | — | Dependencies to exclude from the bundle |
| `splitting` | `boolean` | `true` | Enable code splitting for shared chunks |
| `publicDir` | `string` | `'public'` | Directory for static assets copied to output |
| `base` | `string` | `'/'` | Base public path for all assets |
| `chunkSizeWarningLimit` | `number` | `500` | Warn when a chunk exceeds this size (KB) |

```ts
export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: true,
    target: 'es2020',
    external: ['react', 'react-dom'],
    splitting: true,
  },
});
```

The build produces three outputs:
- `dist/client/` — Browser assets (JS, CSS, static files) with content-hashed filenames
- `dist/server/` — Node.js SSR modules and API handlers
- `dist/manifest.json` — Maps routes to their built assets

---

### Resolve Options

Control how Pyra resolves module imports. Nested under `resolve`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `alias` | `Record<string, string>` | — | Path aliases for imports |
| `extensions` | `string[]` | `['.ts', '.tsx', '.js', '.jsx', '.json']` | File extensions to try when resolving imports |
| `mainFields` | `string[]` | `['module', 'main']` | Fields to check in `package.json` when resolving packages |
| `conditions` | `string[]` | — | Conditions for the `package.json` exports field |

```ts
export default defineConfig({
  resolve: {
    alias: {
      '@': './src',
      '@components': './src/components',
      '@utils': './src/shared/utils',
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
});
```

Aliases are resolved before anything else, so `import { Button } from '@components/Button'` becomes `import { Button } from './src/components/Button'`. If your `tsconfig.json` defines `paths`, keep them aligned with your Pyra aliases so TypeScript and the bundler agree on where files live.

---

### Environment Variables

Control how Pyra loads and exposes environment variables. Nested under `env`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dir` | `string` | project root | Directory containing `.env` files |
| `prefix` | `string \| string[]` | `'PYRA_'` | Only variables with this prefix are exposed to client code |
| `files` | `string[]` | — | Additional `.env` files to load |

```ts
export default defineConfig({
  env: {
    prefix: ['PYRA_', 'PUBLIC_'],
    files: ['.env.local'],
  },
});
```

Pyra loads environment files in layers. Each file overrides the previous:

```
.env                    Base values (committed to git)
  ↓ overridden by
.env.local              Local overrides (gitignored)
  ↓ overridden by
.env.[mode]             Mode-specific values (.env.development, .env.production)
```

Only variables matching the configured prefix are exposed to client-side code through the `RequestContext.env` object. This is a security boundary — unprefixed variables like `DATABASE_URL` or `API_SECRET` are never sent to the browser.

In server-side code (`load()` functions, API routes, middleware), you can access filtered env vars from the `context.env` object:

```ts
export async function load(context: RequestContext) {
  const apiUrl = context.env.API_URL; // from PYRA_API_URL
  const data = await fetch(apiUrl);
  return data.json();
}
```

---

### Rendering Modes

Pyra supports three rendering modes, configurable globally or per-route.

| Mode | Behavior |
|------|----------|
| `ssr` (default) | Server-renders on every request, then hydrates on the client. Best for dynamic, interactive pages. |
| `ssg` | Prerendered to static HTML at build time. Best for content that rarely changes (blog posts, marketing pages). |
| `spa` | Serves an HTML shell, renders entirely on the client. Best for client-only apps behind authentication. |

Set the global default in your config:

```ts
export default defineConfig({
  renderMode: 'ssr',
});
```

Override per-route by exporting `render` from a page module:

```ts
// src/routes/about/page.tsx
export const render = 'ssg';

export default function About() {
  return <h1>About Us</h1>;
}
```

Resolution priority (first match wins):
1. `export const render = '...'` on the route module
2. `export const prerender = true` on the route module (treated as `'ssg'`)
3. Global `renderMode` in `pyra.config.ts`

---

### Request Tracing

Control the transparency layer that shows exactly what happens during each request. Nested under `trace`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `production` | `'off' \| 'header' \| 'on'` | `'off'` | When to enable tracing in production |
| `bufferSize` | `number` | `200` | Number of traces to keep in the ring buffer |

```ts
export default defineConfig({
  trace: {
    production: 'header',
    bufferSize: 500,
  },
});
```

In development, tracing is always on — every request logs a structured trace to the terminal showing route matching, middleware execution, data loading, rendering, and asset injection with timing for each stage.

In production, the three modes are:
- `'off'` — No tracing, zero overhead (default)
- `'header'` — Trace only when the request includes `X-Pyra-Trace: 1`
- `'on'` — Trace every request (useful for staging environments)

Traced responses include a `Server-Timing` header in W3C format, which Chrome DevTools renders as a timing waterfall in the Network panel.

---

### Build Report

Control the post-build summary. Nested under `buildReport`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `warnSize` | `number` | `51200` (50 KB) | Warn when a route's client JS exceeds this size in bytes |

```ts
export default defineConfig({
  buildReport: {
    warnSize: 102400, // warn at 100 KB instead of 50 KB
  },
});
```

After every `pyra build`, Pyra prints a per-route report showing bundle sizes, render modes, data loaders, middleware counts, and layout chains. Routes exceeding the `warnSize` threshold are highlighted.

---

### Plugins

Extend Pyra's behavior with plugins. The `plugins` array accepts objects implementing the `PyraPlugin` interface.

| Hook | When It Runs | Purpose |
|------|-------------|---------|
| `config(config, mode)` | Before config is finalized | Modify the config object |
| `setup(api)` | When the build pipeline is constructed | Register esbuild plugins, add middleware |
| `transform(code, id)` | Per-module during compilation | Transform source code |
| `serverStart(server)` | When the dev server starts | Access the running server |
| `buildStart()` | Before the build begins | Run pre-build tasks |
| `buildEnd()` | After the build completes | Run post-build tasks |

```ts
import type { PyraPlugin } from 'pyrajs-shared';

function myPlugin(): PyraPlugin {
  return {
    name: 'my-plugin',
    config(config, mode) {
      return {
        ...config,
        define: {
          ...config.define,
          __PLUGIN_ACTIVE__: true,
        },
      };
    },
    setup(api) {
      const config = api.getConfig();
      // Register esbuild plugins, middleware, etc.
    },
    transform(code, id) {
      if (id.endsWith('.special')) {
        return { code: transformSpecialFile(code) };
      }
      return null; // no transform for this file
    },
  };
}

export default defineConfig({
  plugins: [myPlugin()],
});
```

---

### Features

Toggle built-in features. Nested under `features`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cssModules` | `boolean` | `true` | Enable CSS modules (`*.module.css`) |
| `typeCheck` | `boolean` | `true` | Enable TypeScript type checking |
| `jsx` | `boolean` | `true` | Enable JSX/TSX support |

```ts
export default defineConfig({
  features: {
    cssModules: true,
    typeCheck: false, // disable if using a separate tsc process
  },
});
```

---

### Advanced: esbuild Options

Pass custom options directly to esbuild. Nested under `esbuild`. This is an escape hatch — most projects should not need it.

```ts
export default defineConfig({
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    legalComments: 'none',
  },
});
```

---

## Complete Example

A real-world config for a full-stack SSR application:

```ts
// pyra.config.ts
import { defineConfigFn } from 'pyrajs-shared';

export default defineConfigFn((mode) => {
  const isDev = mode === 'development';

  return {
    routesDir: 'src/routes',
    adapter: 'react',
    renderMode: 'ssr',
    appContainerId: 'root',

    server: {
      port: 3000,
      open: isDev,
      cors: true,
      proxy: isDev ? {
        '/api/external': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
      } : undefined,
    },

    build: {
      outDir: 'dist',
      sourcemap: isDev ? 'inline' : false,
      minify: !isDev,
      target: 'es2020',
      splitting: true,
    },

    resolve: {
      alias: {
        '@': './src',
        '@components': './src/components',
      },
    },

    env: {
      prefix: 'PYRA_',
    },

    trace: {
      production: 'header',
    },

    buildReport: {
      warnSize: 51200,
    },
  };
});
```

---

## Default Values

When no config file is present, Pyra uses these defaults:

```ts
{
  entry: 'src/index.ts',
  outDir: 'dist',
  port: 3000,
  mode: 'development',     // 'production' for pyra build
  root: process.cwd(),
  renderMode: 'ssr',
}
```

Every other option is either `undefined` (disabled) or has a sensible default documented in the tables above.

---

## CLI Flag Overrides

Every command accepts flags that override config file values. Some common ones:

```bash
# Dev server
pyra dev --port 8080 --open --mode production --config ./custom.config.ts

# Production build
pyra build --out-dir build --minify --sourcemap --mode production

# Production server
pyra start --port 4000 --dist ./build
```

You can also point to a specific config file with `--config`:

```bash
pyra dev --config configs/pyra.staging.ts
```

---

## Validation

Pyra validates your config at startup and throws clear errors for common mistakes:

- **Missing entry** — `entry` is required (defaults to `'src/index.ts'`)
- **Invalid port** — must be between 1 and 65535
- **Missing root** — the `root` directory must exist on disk

If validation fails, Pyra logs the specific error and exits before starting the server or build.

---

## Tips

- **Start with zero config.** Add options only when you need to change something. The defaults are designed for the most common case.
- **Use `defineConfig` or `defineConfigFn`.** They provide IntelliSense in your editor and catch typos before runtime.
- **Keep environment-specific logic in the config function.** Use `defineConfigFn` and branch on `mode` instead of maintaining separate config files.
- **Align `resolve.alias` with `tsconfig.json` paths.** Both TypeScript and the bundler need to agree on where aliases point.
- **Scope proxy rules to development.** Your production server handles API routing directly — proxies are a dev convenience.
